package update

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const CacheMaxAge = 24 * time.Hour

// CacheData is the validated, local-only result of the last update check.
type CacheData struct {
	LatestVersion   string    `json:"latestVersion"`
	CurrentVersion  string    `json:"currentVersion"`
	LastCheck       time.Time `json:"lastCheck"`
	ReleaseURL      string    `json:"releaseUrl"`
	UpdateAvailable bool      `json:"updateAvailable"`
	ReleaseNotes    string    `json:"releaseNotes,omitempty"`
}

// DefaultCachePath returns ~/.guiho/mirror/cache.json.
func DefaultCachePath() (string, error) {
	if override := os.Getenv("MIRROR_CACHE_DIR"); override != "" {
		return filepath.Join(override, "cache.json"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve user home: %w", err)
	}
	return filepath.Join(home, ".guiho", "mirror", "cache.json"), nil
}

// LoadCache strictly reads the owned cache contract. A missing cache is not an
// error; corrupt data is returned as an error so callers can treat it as a miss.
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
		return nil, fmt.Errorf("read update cache: %w", err)
	}
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()
	var cache CacheData
	if err := decoder.Decode(&cache); err != nil {
		return nil, fmt.Errorf("decode update cache: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, errors.New("decode update cache: expected exactly one JSON document")
	}
	if cache.LastCheck.IsZero() || cache.LatestVersion == "" || cache.CurrentVersion == "" {
		return nil, errors.New("decode update cache: required fields are missing")
	}
	if _, ok := VersionFromTag("mirror/v" + strings.TrimPrefix(cache.LatestVersion, "v")); !ok {
		return nil, errors.New("decode update cache: latestVersion is not semantic version")
	}
	return &cache, nil
}

// SaveCache atomically writes cache data without a predictable shared temp path.
func SaveCache(path string, cache *CacheData) error {
	if cache == nil {
		return errors.New("save update cache: cache is nil")
	}
	if path == "" {
		var err error
		path, err = DefaultCachePath()
		if err != nil {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create update cache directory: %w", err)
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".mirror-cache-*")
	if err != nil {
		return fmt.Errorf("create temporary update cache: %w", err)
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	encoder := json.NewEncoder(temp)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(cache); err != nil {
		temp.Close()
		return fmt.Errorf("encode update cache: %w", err)
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return fmt.Errorf("sync update cache: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close update cache: %w", err)
	}
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("replace update cache: %w", err)
	}
	return nil
}

func IsExpiredAt(cache *CacheData, ttl time.Duration, now time.Time) bool {
	if cache == nil || cache.LastCheck.After(now.Add(time.Minute)) {
		return true
	}
	return now.Sub(cache.LastCheck) > ttl
}

func IsExpired(cache *CacheData, ttl time.Duration) bool {
	return IsExpiredAt(cache, ttl, time.Now())
}

// ReadNotice is foreground-safe: it performs local file IO only.
func ReadNotice(currentVersion string, now time.Time) string {
	cache, err := LoadCache("")
	if err != nil || IsExpiredAt(cache, CacheMaxAge, now) ||
		!cache.UpdateAvailable || CompareVersions(cache.LatestVersion, currentVersion) <= 0 {
		return ""
	}
	return fmt.Sprintf(
		"A newer Mirror version is available: %s (current %s). Run `mirror upgrade`.\n",
		cache.LatestVersion,
		currentVersion,
	)
}
