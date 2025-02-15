// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';
import debounce from 'lodash/debounce';

import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import FileInfoPreview from 'components/file_info_preview';

import {getSiteURL} from 'utils/url';

const INITIAL_RENDERED_PAGES = 3;

export default class PDFPreview extends React.PureComponent {
    static propTypes = {

        /**
        * Compare file types
        */
        fileInfo: PropTypes.object.isRequired,

        /**
        *  URL of pdf file to output and compare to update props url
        */
        fileUrl: PropTypes.string.isRequired,
        scale: PropTypes.number.isRequired,
        handleBgClose: PropTypes.func.isRequired,
    }

    constructor(props) {
        super(props);

        this.pdfPagesRendered = {};
        this.container = React.createRef();

        this.state = {
            pdf: null,
            pdfPages: {},
            pdfPagesLoaded: {},
            numPages: 0,
            loading: true,
            success: false,
        };
    }

    componentDidMount() {
        this.getPdfDocument();
        if (this.container.current) {
            this.parentNode = this.container.current.parentElement;
            this.parentNode.addEventListener('scroll', this.handleScroll);
        }
    }

    componentWillUnmount() {
        if (this.parentNode) {
            this.parentNode.removeEventListener('scroll', this.handleScroll);
        }
    }

    static getDerivedStateFromProps(props, state) {
        if (props.fileUrl !== state.prevFileUrl) {
            return {
                pdf: null,
                pdfPages: {},
                pdfPagesLoaded: {},
                numPages: 0,
                loading: true,
                success: false,
                prevFileUrl: props.fileUrl,
            };
        }
        return null;
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.fileUrl !== prevProps.fileUrl) {
            this.getPdfDocument();
            this.pdfPagesRendered = {};
        }
        if (this.props.scale !== prevProps.scale) {
            this.pdfPagesRendered = {};
            if (this.state.success) {
                for (let i = 0; i < this.state.numPages; i++) {
                    this.renderPDFPage(i);
                }
            }
        }

        if (!prevState.success && this.state.success) {
            for (let i = 0; i < this.state.numPages; i++) {
                this.renderPDFPage(i);
            }
        }
    }

    downloadFile = (e) => {
        const fileDownloadUrl = this.props.fileInfo.link || getFileDownloadUrl(this.props.fileInfo.id);
        e.preventDefault();
        window.location.href = fileDownloadUrl;
    }

    isInViewport = (page) => {
        const bounding = page.getBoundingClientRect();
        const viewportTop = this.container.current.scrollTop;
        const viewportBottom = viewportTop + this.container.current.parentElement.clientHeight;
        return (
            (bounding.top >= viewportTop && bounding.top <= viewportBottom) ||
            (bounding.bottom >= viewportTop && bounding.bottom <= viewportBottom) ||
            (bounding.top <= viewportTop && bounding.bottom >= viewportBottom)
        );
    };

    renderPDFPage = async (pageIndex) => {
        const canvas = this[`pdfCanvasRef-${pageIndex}`].current;
        if (!canvas) {
            // Refs are undefined when testing
            return;
        }

        // Always render the first INITIAL_RENDERED_PAGES pages to avoid
        // problems detecting isInViewport during the open animation
        if (pageIndex >= INITIAL_RENDERED_PAGES && !this.isInViewport(canvas)) {
            return;
        }

        if (this.pdfPagesRendered[pageIndex]) {
            return;
        }

        const page = await this.loadPage(this.state.pdf, pageIndex);
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({scale: this.props.scale});
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport,
        };

        await page.render(renderContext).promise;
        this.pdfPagesRendered[pageIndex] = true;
    }

    getPdfDocument = async () => {
        try {
            const PDFJS = await import('pdfjs-dist');
            const worker = await import('pdfjs-dist/build/pdf.worker.entry.js');
            PDFJS.GlobalWorkerOptions.workerSrc = worker;

            const pdf = await PDFJS.getDocument({
                url: this.props.fileUrl,
                cMapUrl: getSiteURL() + '/static/cmaps/',
                cMapPacked: true,
            }).promise;
            this.onDocumentLoad(pdf);
        } catch (err) {
            this.onDocumentLoadError(err);
        }
    }

    onDocumentLoad = (pdf) => {
        this.setState({pdf, numPages: pdf.numPages});
        for (let i = 0; i < pdf.numPages; i++) {
            this[`pdfCanvasRef-${i}`] = React.createRef();
        }
        this.setState({loading: false, success: true});
    }

    onDocumentLoadError = (reason) => {
        console.log('Unable to load PDF preview: ' + reason); //eslint-disable-line no-console
        this.setState({loading: false, success: false});
    }

    loadPage = async (pdf, pageIndex) => {
        if (this.state.pdfPagesLoaded[pageIndex]) {
            return this.state.pdfPages[pageIndex];
        }

        const page = await pdf.getPage(pageIndex + 1);

        const pdfPages = Object.assign({}, this.state.pdfPages);
        pdfPages[pageIndex] = page;

        const pdfPagesLoaded = Object.assign({}, this.state.pdfPagesLoaded);
        pdfPagesLoaded[pageIndex] = true;
        this.setState({pdfPages, pdfPagesLoaded});

        return page;
    }

    handleScroll = debounce(() => {
        if (this.state.success) {
            for (let i = 0; i < this.state.numPages; i++) {
                this.renderPDFPage(i);
            }
        }
    }, 100);

    render() {
        if (this.state.loading) {
            return (
                <div
                    ref={this.container}
                    className='view-image__loading'
                >
                    <LoadingSpinner/>
                </div>
            );
        }

        if (!this.state.success) {
            return (
                <FileInfoPreview
                    fileInfo={this.props.fileInfo}
                    fileUrl={this.props.fileUrl}
                />
            );
        }

        const pdfCanvases = [];
        for (let i = 0; i < this.state.numPages; i++) {
            pdfCanvases.push(
                <canvas
                    ref={this[`pdfCanvasRef-${i}`]}
                    key={'previewpdfcanvas' + i}
                />,
            );

            if (i < this.state.numPages - 1 && this.state.numPages > 1) {
                pdfCanvases.push(
                    <div
                        key={'previewpdfspacer' + i}
                        className='pdf-preview-spacer'
                    />,
                );
            }
        }

        return (
            <div
                ref={this.container}
                className='post-code'
                onClick={this.props.handleBgClose}
            >
                {pdfCanvases}
            </div>
        );
    }
}
