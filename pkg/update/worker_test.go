package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestRunWorker(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"tag_name": "v3.8.0",
			"name": "Mirror 3.8.0",
			"html_url": "https://example.com/release/v3.8.0",
			"body": "Worker test release notes"
		}`))
	}))
	defer server.Close()

	tempDir := t.TempDir()
	cachePath := filepath.Join(tempDir, "test-update-cache.json")

	opts := CatalogOptions{
		BaseURL: server.URL,
		Repo:    "CGuiho/mirror",
	}

	err := RunWorker(context.Background(), "3.7.3", opts, cachePath)
	if err != nil {
		t.Fatalf("RunWorker failed: %v", err)
	}

	cache, err := LoadCache(cachePath)
	if err != nil {
		t.Fatalf("LoadCache failed: %v", err)
	}

	if cache.LatestVersion != "v3.8.0" {
		t.Errorf("Expected LatestVersion v3.8.0, got %s", cache.LatestVersion)
	}
	if !cache.UpdateAvailable {
		t.Error("Expected UpdateAvailable to be true")
	}
}
