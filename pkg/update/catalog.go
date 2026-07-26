package update

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
)

const (
	DefaultRepo    = "CGuiho/mirror"
	DefaultBaseURL = "https://api.github.com"
	maxPages       = 100
)

type ReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

type Release struct {
	TagName     string         `json:"tag_name"`
	Name        string         `json:"name"`
	PublishedAt time.Time      `json:"published_at"`
	HTMLURL     string         `json:"html_url"`
	Body        string         `json:"body"`
	Prerelease  bool           `json:"prerelease"`
	Draft       bool           `json:"draft"`
	Assets      []ReleaseAsset `json:"assets"`
	Version     string         `json:"-"`
}

type CatalogOptions struct {
	BaseURL    string
	HTTPClient *http.Client
	Repo       string
}

func catalogDefaults(opts CatalogOptions) (string, string, *http.Client) {
	repo := opts.Repo
	if repo == "" {
		repo = DefaultRepo
	}
	baseURL := strings.TrimRight(opts.BaseURL, "/")
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	client := opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return repo, baseURL, client
}

// FetchReleases exhausts the GitHub catalog, retains only canonical
// mirror/vX.Y.Z tags, deduplicates by tag, and sorts by semantic version.
func FetchReleases(ctx context.Context, opts CatalogOptions) ([]Release, error) {
	repo, baseURL, client := catalogDefaults(opts)
	seen := map[string]bool{}
	releases := []Release{}
	for page := 1; page <= maxPages; page++ {
		url := fmt.Sprintf("%s/repos/%s/releases?per_page=100&page=%d", baseURL, repo, page)
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("create GitHub release request: %w", err)
		}
		request.Header.Set("User-Agent", "guiho-mirror-go")
		request.Header.Set("Accept", "application/vnd.github+json")
		response, err := client.Do(request)
		if err != nil {
			return nil, fmt.Errorf("fetch GitHub releases: %w", err)
		}
		if response.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(io.LimitReader(response.Body, 4<<10))
			response.Body.Close()
			return nil, fmt.Errorf("GitHub releases returned %s: %s", response.Status, strings.TrimSpace(string(body)))
		}
		var batch []Release
		decoder := json.NewDecoder(io.LimitReader(response.Body, 8<<20))
		if err := decoder.Decode(&batch); err != nil {
			response.Body.Close()
			return nil, fmt.Errorf("decode GitHub releases: %w", err)
		}
		var trailing any
		if err := decoder.Decode(&trailing); err != io.EOF {
			response.Body.Close()
			return nil, fmt.Errorf("decode GitHub releases: expected exactly one JSON document")
		}
		if err := response.Body.Close(); err != nil {
			return nil, fmt.Errorf("close GitHub releases response: %w", err)
		}
		for _, release := range batch {
			version, ok := VersionFromTag(release.TagName)
			if !ok || release.Draft || seen[release.TagName] {
				continue
			}
			release.Version = version
			release.Prerelease = release.Prerelease || strings.Contains(version, "-")
			seen[release.TagName] = true
			releases = append(releases, release)
		}
		if len(batch) < 100 {
			sort.Slice(releases, func(i, j int) bool {
				left, _ := semver.StrictNewVersion(releases[i].Version)
				right, _ := semver.StrictNewVersion(releases[j].Version)
				return left.GreaterThan(right)
			})
			return releases, nil
		}
	}
	return nil, fmt.Errorf("GitHub release pagination exceeded %d pages", maxPages)
}

func FetchLatestRelease(ctx context.Context, opts CatalogOptions) (*Release, error) {
	releases, err := FetchReleases(ctx, opts)
	if err != nil {
		return nil, err
	}
	for i := range releases {
		if !releases[i].Prerelease {
			return &releases[i], nil
		}
	}
	return nil, fmt.Errorf("no stable canonical Mirror release found")
}

func VersionFromTag(tag string) (string, bool) {
	const prefix = "mirror/v"
	if !strings.HasPrefix(tag, prefix) {
		return "", false
	}
	version := strings.TrimPrefix(tag, prefix)
	parsed, err := semver.StrictNewVersion(version)
	if err != nil || parsed.Original() != version {
		return "", false
	}
	return version, true
}

func CompareVersions(v1, v2 string) int {
	left, leftErr := semver.StrictNewVersion(strings.TrimPrefix(v1, "v"))
	right, rightErr := semver.StrictNewVersion(strings.TrimPrefix(v2, "v"))
	if leftErr != nil || rightErr != nil {
		return strings.Compare(v1, v2)
	}
	return left.Compare(right)
}
