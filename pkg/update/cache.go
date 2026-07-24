package update

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

// CacheData represents the cached update information saved to disk.
type CacheData struct {
	LatestVersion   string    `json:"latestVersion"`
	CurrentVersion  string    `json:"currentVersion"`
	LastCheck       time.Time `json:"lastCheck"`
	ReleaseURL      string    `json:"releaseUrl"`
	UpdateAvailable bool      `json:"updateAvailable"`
	ReleaseNotes    string    `json:"releaseNotes,omitempty"`
}

// DefaultCachePath returns the path to the update cache file (~/.runx/update-cache.json).
func DefaultCachePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".runx", "update-cache.json"), nil
}

// LoadCache reads and unmarshals the cache data from the specified path.
func LoadCache(path string) (*CacheData, error) {
	if path == "" {
		var err error
		path, err = DefaultCachePath()
		if err != nil {
			return nil, err
		}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}

	var cache CacheData
	if err := json.Unmarshal(data, &cache); err != nil {
		return nil, err
	}

	return &cache, nil
}

// SaveCache marshals and atomically writes cache data to the specified path.
func SaveCache(path string, cache *CacheData) error {
	if path == "" {
		var err error
		path, err = DefaultCachePath()
		if err != nil {
			return err
		}
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return err
	}

	tmpFile := path + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return err
	}

	return os.Rename(tmpFile, path)
}

// IsExpired checks if the cache is older than the specified TTL.
func IsExpired(cache *CacheData, ttl time.Duration) bool {
	if cache == nil {
		return true
	}
	return time.Since(cache.LastCheck) > ttl
}
