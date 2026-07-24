package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		v1       string
		v2       string
		expected int
	}{
		{"3.7.3", "3.7.3", 0},
		{"v3.7.4", "3.7.3", 1},
		{"3.7.2", "v3.7.3", -1},
		{"3.8.0-rc1", "3.8.0", -1},
		{"4.0.0", "3.9.9", 1},
	}

	for _, tt := range tests {
		result := CompareVersions(tt.v1, tt.v2)
		if result != tt.expected {
			t.Errorf("CompareVersions(%q, %q) = %d; want %d", tt.v1, tt.v2, result, tt.expected)
		}
	}
}

func TestFetchLatestRelease(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/CGuiho/mirror/releases/latest" {
			t.Errorf("Unexpected path: %s", r.URL.Path)
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"tag_name": "v3.8.0",
			"name": "Mirror 3.8.0",
			"html_url": "https://github.com/CGuiho/mirror/releases/tag/v3.8.0",
			"body": "Release notes content",
			"assets": [
				{
					"name": "mirror-windows-amd64.exe",
					"browser_download_url": "https://github.com/CGuiho/mirror/releases/download/v3.8.0/mirror-windows-amd64.exe",
					"size": 1024
				}
			]
		}`))
	}))
	defer server.Close()

	opts := CatalogOptions{
		BaseURL: server.URL,
		Repo:    "CGuiho/mirror",
	}

	rel, err := FetchLatestRelease(context.Background(), opts)
	if err != nil {
		t.Fatalf("FetchLatestRelease failed: %v", err)
	}

	if rel.TagName != "v3.8.0" {
		t.Errorf("Expected TagName v3.8.0, got %s", rel.TagName)
	}
	if len(rel.Assets) != 1 || rel.Assets[0].Name != "mirror-windows-amd64.exe" {
		t.Errorf("Unexpected assets in response: %+v", rel.Assets)
	}
}
