package update

import (
	"context"
	"fmt"
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

func TestFetchReleasesExhaustsPagesFiltersAndSorts(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Query().Get("page") == "1" {
			fmt.Fprint(w, "[")
			for index := 0; index < 100; index++ {
				if index > 0 {
					fmt.Fprint(w, ",")
				}
				fmt.Fprintf(w, `{"tag_name":"ignored/%d.0.0"}`, index)
			}
			fmt.Fprint(w, "]")
			return
		}
		fmt.Fprint(w, `[
			{"tag_name":"mirror/v3.8.0"},
			{"tag_name":"mirror/v3.10.0"},
			{"tag_name":"mirror/v3.10.0"},
			{"tag_name":"mirror/v03.11.0"},
			{"tag_name":"mirror/v4.0.0","draft":true}
		]`)
	}))
	defer server.Close()
	releases, err := FetchReleases(context.Background(), CatalogOptions{BaseURL: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	if requests != 2 {
		t.Fatalf("expected exhaustive pagination, got %d requests", requests)
	}
	if len(releases) != 2 || releases[0].Version != "3.10.0" || releases[1].Version != "3.8.0" {
		t.Fatalf("unexpected filtered catalog: %#v", releases)
	}
}

func TestVersionFromTagIsStrict(t *testing.T) {
	valid := []string{"mirror/v0.1.0", "mirror/v3.8.0-rc.1"}
	for _, tag := range valid {
		if _, ok := VersionFromTag(tag); !ok {
			t.Fatalf("expected valid tag %q", tag)
		}
	}
	invalid := []string{"v3.8.0", "@guiho/mirror@3.8.0", "mirror/v03.8.0", "mirror/v3.8", "mirror/v3.8.0/"}
	for _, tag := range invalid {
		if _, ok := VersionFromTag(tag); ok {
			t.Fatalf("expected invalid tag %q", tag)
		}
	}
}

func TestFetchLatestRelease(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/CGuiho/mirror/releases" {
			t.Errorf("Unexpected path: %s", r.URL.Path)
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`[{
			"tag_name": "mirror/v3.8.0",
			"name": "Mirror 3.8.0",
			"html_url": "https://github.com/CGuiho/mirror/releases/tag/mirror/v3.8.0",
			"body": "Release notes content",
			"assets": [
				{
					"name": "mirror-windows-amd64.exe",
					"browser_download_url": "https://github.com/CGuiho/mirror/releases/download/v3.8.0/mirror-windows-amd64.exe",
					"size": 1024
				}
			]
		}]`))
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

	if rel.TagName != "mirror/v3.8.0" {
		t.Errorf("Expected TagName mirror/v3.8.0, got %s", rel.TagName)
	}
	if len(rel.Assets) != 1 || rel.Assets[0].Name != "mirror-windows-amd64.exe" {
		t.Errorf("Unexpected assets in response: %+v", rel.Assets)
	}
}
