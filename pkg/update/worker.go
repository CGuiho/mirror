package update

import (
	"context"
	"os"
	"os/exec"
	"time"
)

const WorkerEnvVar = "MIRROR_BACKGROUND_WORKER"

// LaunchBackgroundWorker launches the update worker process detached from the current process group.
func LaunchBackgroundWorker(execPath string, currentVersion string, opts CatalogOptions) error {
	if os.Getenv(WorkerEnvVar) == "1" {
		return nil
	}

	repo := opts.Repo
	if repo == "" {
		repo = DefaultRepo
	}

	cmd := exec.Command(execPath, "update", "worker", "--current-version", currentVersion, "--repo", repo)
	cmd.Env = append(os.Environ(), WorkerEnvVar+"=1")
	setDetachSysProcAttr(cmd)
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil

	return cmd.Start()
}

// RunWorker executes the background update fetch and writes the TTL cache file.
func RunWorker(ctx context.Context, currentVersion string, opts CatalogOptions, cachePath string) error {
	if cachePath == "" {
		var err error
		cachePath, err = DefaultCachePath()
		if err != nil {
			return err
		}
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	rel, err := FetchLatestRelease(ctxTimeout, opts)
	if err != nil {
		return err
	}

	latestVer := rel.TagName
	isNewer := CompareVersions(latestVer, currentVersion) > 0

	cache := &CacheData{
		LatestVersion:   latestVer,
		CurrentVersion:  currentVersion,
		LastCheck:       time.Now(),
		ReleaseURL:      rel.HTMLURL,
		UpdateAvailable: isNewer,
		ReleaseNotes:    rel.Body,
	}

	return SaveCache(cachePath, cache)
}
