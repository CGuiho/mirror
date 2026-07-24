package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// UpgradeOptions specifies options for performing a self-upgrade.
type UpgradeOptions struct {
	CurrentExecutablePath string
	TargetVersion         string
	DownloadURL           string
	ExpectedChecksum      string
	HTTPClient            *http.Client
}

// GetTargetAssetName returns the expected release binary asset name for the given GOOS and GOARCH.
func GetTargetAssetName(goos, goarch string) string {
	ext := ""
	if goos == "windows" {
		ext = ".exe"
	}

	archStr := goarch
	if goarch == "amd64" {
		archStr = "x64"
	}

	return fmt.Sprintf("mirror-%s-%s%s", goos, archStr, ext)
}

// GetCurrentTargetAssetName returns the target asset name for the current runtime platform.
func GetCurrentTargetAssetName() string {
	return GetTargetAssetName(runtime.GOOS, runtime.GOARCH)
}

// PerformSelfUpgrade downloads the target binary, verifies its SHA256 checksum, and performs an atomic rename swap.
func PerformSelfUpgrade(opts UpgradeOptions) error {
	execPath := opts.CurrentExecutablePath
	if execPath == "" {
		var err error
		execPath, err = os.Executable()
		if err != nil {
			return fmt.Errorf("failed to determine executable path: %w", err)
		}
	}
	execPath, err := filepath.EvalSymlinks(execPath)
	if err != nil {
		return fmt.Errorf("failed to resolve symlink for executable: %w", err)
	}

	client := opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 60 * time.Second}
	}

	// 1. Download binary to staging path (.new)
	stagingPath := execPath + ".new"
	resp, err := client.Get(opts.DownloadURL)
	if err != nil {
		return fmt.Errorf("failed to download update binary from %s: %w", opts.DownloadURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download returned non-200 status: %d", resp.StatusCode)
	}

	out, err := os.OpenFile(stagingPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return fmt.Errorf("failed to create staging file %s: %w", stagingPath, err)
	}

	hasher := sha256.New()
	multiWriter := io.MultiWriter(out, hasher)

	if _, err := io.Copy(multiWriter, resp.Body); err != nil {
		out.Close()
		os.Remove(stagingPath)
		return fmt.Errorf("failed to save downloaded binary: %w", err)
	}
	out.Close()

	// 2. Verify SHA256 Checksum if provided
	if opts.ExpectedChecksum != "" {
		calculatedChecksum := hex.EncodeToString(hasher.Sum(nil))
		expectedClean := strings.TrimSpace(strings.ToLower(opts.ExpectedChecksum))
		if calculatedChecksum != expectedClean {
			os.Remove(stagingPath)
			return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedClean, calculatedChecksum)
		}
	}

	// 3. Atomic Rename Swap
	backupPath := execPath + ".old"
	_ = os.Remove(backupPath) // Clean old backup if present

	if err := os.Rename(execPath, backupPath); err != nil {
		os.Remove(stagingPath)
		return fmt.Errorf("failed to rename current binary to backup: %w", err)
	}

	if err := os.Rename(stagingPath, execPath); err != nil {
		// Attempt instant rollback
		_ = os.Rename(backupPath, execPath)
		os.Remove(stagingPath)
		return fmt.Errorf("failed to swap new binary into place (rolled back): %w", err)
	}

	if runtime.GOOS != "windows" {
		_ = os.Chmod(execPath, 0755)
	}

	return nil
}
