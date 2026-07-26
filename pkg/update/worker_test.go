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
		w.Write([]byte(`[{
			"tag_name": "mirror/v3.8.0",
			"name": "Mirror 3.8.0",
			"html_url": "https://example.com/release/mirror/v3.8.0",
			"body": "Worker test release notes"
		}]`))
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

	if cache.LatestVersion != "3.8.0" {
		t.Errorf("Expected LatestVersion 3.8.0, got %s", cache.LatestVersion)
	}
	if !cache.UpdateAvailable {
		t.Error("Expected UpdateAvailable to be true")
	}
}

func TestLeaseIsTokenOwned(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cache.lease")
	token, acquired := acquireLease(path)
	if !acquired {
		t.Fatal("expected lease acquisition")
	}
	if releaseLease(path, "wrong-token") {
		t.Fatal("wrong token released lease")
	}
	if _, acquired := acquireLease(path); acquired {
		t.Fatal("active 30-second lease was stolen")
	}
	if !releaseLease(path, token) {
		t.Fatal("owner token did not release lease")
	}
}
