package update

import (
	"path/filepath"
	"testing"
	"time"
)

func TestCacheSaveAndLoad(t *testing.T) {
	tempDir := t.TempDir()
	cachePath := filepath.Join(tempDir, "subDir", "update-cache.json")

	now := time.Now().Truncate(time.Second)
	initialCache := &CacheData{
		LatestVersion:   "3.8.0",
		CurrentVersion:  "3.7.3",
		LastCheck:       now,
		ReleaseURL:      "https://github.com/CGuiho/mirror/releases/tag/v3.8.0",
		UpdateAvailable: true,
		ReleaseNotes:    "New release features",
	}

	err := SaveCache(cachePath, initialCache)
	if err != nil {
		t.Fatalf("SaveCache failed: %v", err)
	}

	loadedCache, err := LoadCache(cachePath)
	if err != nil {
		t.Fatalf("LoadCache failed: %v", err)
	}

	if loadedCache == nil {
		t.Fatal("Expected loaded cache to be non-nil")
	}

	if loadedCache.LatestVersion != initialCache.LatestVersion {
		t.Errorf("Expected LatestVersion %s, got %s", initialCache.LatestVersion, loadedCache.LatestVersion)
	}
	if loadedCache.UpdateAvailable != initialCache.UpdateAvailable {
		t.Errorf("Expected UpdateAvailable %v, got %v", initialCache.UpdateAvailable, loadedCache.UpdateAvailable)
	}
}

func TestCacheExpiration(t *testing.T) {
	cache := &CacheData{
		LastCheck: time.Now().Add(-25 * time.Hour),
	}
	if !IsExpired(cache, 24*time.Hour) {
		t.Error("Expected cache to be expired")
	}

	freshCache := &CacheData{
		LastCheck: time.Now().Add(-1 * time.Hour),
	}
	if IsExpired(freshCache, 24*time.Hour) {
		t.Error("Expected cache not to be expired")
	}
}

func TestLoadNonExistentCache(t *testing.T) {
	tempDir := t.TempDir()
	cachePath := filepath.Join(tempDir, "nonexistent.json")

	cache, err := LoadCache(cachePath)
	if err != nil {
		t.Fatalf("Expected no error loading missing cache file, got: %v", err)
	}
	if cache != nil {
		t.Errorf("Expected nil cache for non-existent file, got %v", cache)
	}
}
