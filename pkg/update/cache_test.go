package update

import (
	"os"
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

func TestReadNoticeUsesOnlyFreshValidatedCache(t *testing.T) {
	t.Setenv("MIRROR_CACHE_DIR", t.TempDir())
	now := time.Now().UTC().Truncate(time.Second)
	if err := SaveCache("", &CacheData{
		LatestVersion: "3.8.0", CurrentVersion: "3.7.4", LastCheck: now,
		UpdateAvailable: true,
	}); err != nil {
		t.Fatal(err)
	}
	if notice := ReadNotice("3.7.4", now); notice == "" {
		t.Fatal("expected fresh update notice")
	}
	if notice := ReadNotice("3.8.0", now); notice != "" {
		t.Fatalf("did not expect notice for current version: %q", notice)
	}
}

func TestLoadCacheRejectsUnknownFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cache.json")
	if err := os.WriteFile(path, []byte(`{"latestVersion":"3.8.0","currentVersion":"3.7.4","lastCheck":"2026-07-24T00:00:00Z","releaseUrl":"","updateAvailable":true,"unknown":1}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadCache(path); err == nil {
		t.Fatal("expected strict cache decoding error")
	}
}
