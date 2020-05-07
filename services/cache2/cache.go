// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache2

import (
	"errors"
	"time"
)

// ErrKeyNotFound is the error when the given key is not found
var ErrKeyNotFound = errors.New("key not found")

// Cache (under package cache2) is a representation of a cache store that aims to replace cache.Cache
type Cache interface {
	// Purge is used to completely clear the cache.
	Purge() error

	// Set adds the given key and value to the store without an expiry. If the key already exists,
	// it will overwrite the previous value.
	Set(key string, value interface{}) error

	// SetWithDefaultExpiry adds the given key and value to the store with the default expiry. If
	// the key already exists, it will overwrite the previoous value
	SetWithDefaultExpiry(key string, value interface{}) error

	// SetWithExpiry adds the given key and value to the cache with the given expiry. If the key
	// already exists, it will overwrite the previoous value
	SetWithExpiry(key string, value interface{}, ttl time.Duration) error

	// Get the content stored in the cache for the given key, and decode it into the value interface.
	// Return ErrKeyNotFound if the key is missing from the cache
	Get(key string, value interface{}) error

	// Remove deletes the value for a given key.
	Remove(key string) error

	// Keys returns a slice of the keys in the cache.
	Keys() ([]string, error)

	// Len returns the number of items in the cache.
	Len() (int, error)

	// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
	GetInvalidateClusterEvent() string
}