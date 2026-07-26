package update

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	WorkerEnvVar = "MIRROR_UPDATE_WORKER"
	leaseMaxAge  = 30 * time.Second
	workerLimit  = 15 * time.Second
)

func LaunchBackgroundWorker(execPath, currentVersion string, opts CatalogOptions) error {
	if os.Getenv(WorkerEnvVar) == "1" || updateDisabled() {
		return nil
	}
	cachePath, err := DefaultCachePath()
	if err != nil {
		return nil
	}
	leasePath := cachePath + ".lease"
	token, acquired := acquireLease(leasePath)
	if !acquired {
		return nil
	}
	repo := opts.Repo
	if repo == "" {
		repo = DefaultRepo
	}
	command := exec.Command(
		execPath, "upgrade", "__update-worker",
		"--current-version", currentVersion,
		"--repo", repo,
		"--lease", leasePath,
		"--lease-token", token,
	)
	command.Env = append(os.Environ(), WorkerEnvVar+"=1")
	command.Stdin, command.Stdout, command.Stderr = nil, nil, nil
	setDetachSysProcAttr(command)
	if err := command.Start(); err != nil {
		releaseLease(leasePath, token)
		return err
	}
	if err := command.Process.Release(); err != nil {
		releaseLease(leasePath, token)
		return err
	}
	return nil
}

func RunWorker(ctx context.Context, currentVersion string, opts CatalogOptions, cachePath string) error {
	return runWorker(ctx, currentVersion, opts, cachePath, "", "")
}

func RunLeasedWorker(ctx context.Context, currentVersion string, opts CatalogOptions, cachePath, leasePath, token string) error {
	defer releaseLease(leasePath, token)
	return runWorker(ctx, currentVersion, opts, cachePath, leasePath, token)
}

func runWorker(ctx context.Context, currentVersion string, opts CatalogOptions, cachePath, _, _ string) error {
	if cachePath == "" {
		var err error
		cachePath, err = DefaultCachePath()
		if err != nil {
			return err
		}
	}
	bounded, cancel := context.WithTimeout(ctx, workerLimit)
	defer cancel()
	release, err := FetchLatestRelease(bounded, opts)
	if err != nil {
		return err
	}
	return SaveCache(cachePath, &CacheData{
		LatestVersion:   release.Version,
		CurrentVersion:  strings.TrimPrefix(currentVersion, "v"),
		LastCheck:       time.Now().UTC(),
		ReleaseURL:      release.HTMLURL,
		UpdateAvailable: CompareVersions(release.Version, currentVersion) > 0,
	})
}

func acquireLease(path string) (string, bool) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", false
	}
	releaseGuard, acquired := tryLeaseGuard(path)
	if !acquired {
		return "", false
	}
	defer releaseGuard()
	if info, err := os.Stat(path); err == nil {
		if time.Since(info.ModTime()) < leaseMaxAge {
			return "", false
		}
		_ = os.Remove(path)
	}
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", false
	}
	token := hex.EncodeToString(random)
	file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return "", false
	}
	if _, err := fmt.Fprintf(file, "%s\n%d\n", token, os.Getpid()); err != nil {
		file.Close()
		os.Remove(path)
		return "", false
	}
	if err := file.Close(); err != nil {
		os.Remove(path)
		return "", false
	}
	return token, true
}

func releaseLease(path, token string) bool {
	if path == "" || token == "" {
		return false
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	fields := strings.Fields(string(content))
	if len(fields) == 0 || fields[0] != token {
		return false
	}
	return os.Remove(path) == nil
}

func updateDisabled() bool {
	for _, key := range []string{"MIRROR_DISABLE_UPDATE_CHECK", "MIRROR_NO_UPDATE_CHECK"} {
		value := strings.ToLower(os.Getenv(key))
		if value == "1" || value == "true" {
			return true
		}
	}
	return false
}
