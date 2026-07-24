package update

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
)

// ReleaseAsset represents an asset attached to a release.
type ReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

// Release represents a release metadata structure.
type Release struct {
	TagName     string         `json:"tag_name"`
	Name        string         `json:"name"`
	PublishedAt time.Time      `json:"published_at"`
	HTMLURL     string         `json:"html_url"`
	Body        string         `json:"body"`
	Prerelease  bool           `json:"prerelease"`
	Draft       bool           `json:"draft"`
	Assets      []ReleaseAsset `json:"assets"`
}

// CatalogOptions allows customizing the HTTP client and API endpoint for catalog operations.
type CatalogOptions struct {
	BaseURL    string
	HTTPClient *http.Client
	Repo       string
}

const DefaultRepo = "CGuiho/mirror"
const DefaultBaseURL = "https://api.github.com"

// FetchLatestRelease fetches the latest release for the target repository.
func FetchLatestRelease(ctx context.Context, opts CatalogOptions) (*Release, error) {
	repo := opts.Repo
	if repo == "" {
		repo = DefaultRepo
	}
	baseURL := opts.BaseURL
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	client := opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	url := fmt.Sprintf("%s/repos/%s/releases/latest", strings.TrimRight(baseURL, "/"), repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "guiho-mirror-cli")
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github API returned status %d: %s", resp.StatusCode, string(body))
	}

	var rel Release
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, err
	}

	return &rel, nil
}

// FetchReleases fetches all published releases for the target repository.
func FetchReleases(ctx context.Context, opts CatalogOptions) ([]Release, error) {
	repo := opts.Repo
	if repo == "" {
		repo = DefaultRepo
	}
	baseURL := opts.BaseURL
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	client := opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	url := fmt.Sprintf("%s/repos/%s/releases", strings.TrimRight(baseURL, "/"), repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "guiho-mirror-cli")
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github API returned status %d: %s", resp.StatusCode, string(body))
	}

	var releases []Release
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}

	return releases, nil
}

// CompareVersions compares two version strings (e.g. "3.7.3" or "v3.7.4").
// Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
func CompareVersions(v1, v2 string) int {
	v1Clean := strings.TrimPrefix(v1, "v")
	v2Clean := strings.TrimPrefix(v2, "v")

	sv1, err1 := semver.NewVersion(v1Clean)
	sv2, err2 := semver.NewVersion(v2Clean)

	if err1 == nil && err2 == nil {
		return sv1.Compare(sv2)
	}

	// Fallback string comparison if semver parsing fails
	if v1Clean == v2Clean {
		return 0
	}
	if v1Clean > v2Clean {
		return 1
	}
	return -1
}
