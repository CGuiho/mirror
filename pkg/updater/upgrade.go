package updater

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const maxBinaryBytes int64 = 256 << 20
const transactionMaxAge = 10 * time.Minute

type VerifyFunc func(path, targetVersion string) error
type ReplaceFunc func(executable, candidate, backup, targetVersion, checksum, lockPath, lockToken string, verify VerifyFunc) (bool, error)

type UpgradeOptions struct {
	CurrentExecutablePath string
	TargetVersion         string
	DownloadURL           string
	ExpectedChecksum      string
	HTTPClient            *http.Client
	Verify                VerifyFunc
	Replace               ReplaceFunc
	Progress              func(DownloadProgress)
}

type DownloadProgress struct {
	Bytes   int64   `json:"bytes"`
	Total   int64   `json:"total,omitempty"`
	Percent float64 `json:"percent,omitempty"`
}

type UpgradeResult struct {
	ExecutablePath string             `json:"executablePath"`
	BackupPath     string             `json:"backupPath"`
	TargetVersion  string             `json:"targetVersion"`
	Scheduled      bool               `json:"scheduled"`
	Recovery       string             `json:"recovery"`
	Progress       []DownloadProgress `json:"progress,omitempty"`
}

func GetTargetAssetName(goos, goarch string) string {
	extension := ""
	if goos == "windows" {
		extension = ".exe"
	}
	return fmt.Sprintf("mirror-%s-%s%s", goos, goarch, extension)
}

func GetCurrentTargetAssetName() string {
	return GetTargetAssetName(runtime.GOOS, runtime.GOARCH)
}

func TargetAsset(buildTarget string) (string, error) {
	target := strings.TrimSuffix(buildTarget, ".exe")
	switch target {
	case "mirror-linux-amd64", "mirror-linux-arm64", "mirror-linux-armv7", "mirror-linux-armv6",
		"mirror-darwin-amd64", "mirror-darwin-arm64",
		"mirror-windows-amd64", "mirror-windows-arm64":
		if strings.HasPrefix(target, "mirror-windows-") {
			return target + ".exe", nil
		}
		return target, nil
	case "", "development":
		return GetCurrentTargetAssetName(), nil
	default:
		return "", fmt.Errorf("unsupported embedded build target %q", buildTarget)
	}
}

func PerformSelfUpgrade(opts UpgradeOptions) error {
	_, err := Upgrade(opts)
	return err
}

func Upgrade(opts UpgradeOptions) (UpgradeResult, error) {
	result := UpgradeResult{TargetVersion: strings.TrimPrefix(opts.TargetVersion, "v")}
	if result.TargetVersion == "" {
		return result, errors.New("target version is required")
	}
	if parsed, err := url.ParseRequestURI(opts.DownloadURL); err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return result, errors.New("valid HTTP(S) download URL is required")
	}
	expected := strings.ToLower(strings.TrimSpace(opts.ExpectedChecksum))
	if len(expected) != sha256.Size*2 {
		return result, errors.New("expected SHA-256 checksum is required")
	}
	if _, err := hex.DecodeString(expected); err != nil {
		return result, errors.New("expected SHA-256 checksum is invalid")
	}

	executable := opts.CurrentExecutablePath
	if executable == "" {
		var err error
		executable, err = os.Executable()
		if err != nil {
			return result, fmt.Errorf("determine executable path: %w", err)
		}
	}
	executable, err := filepath.Abs(executable)
	if err != nil {
		return result, fmt.Errorf("resolve executable path: %w", err)
	}
	if resolved, resolveErr := filepath.EvalSymlinks(executable); resolveErr == nil {
		executable = resolved
	}
	result.ExecutablePath = executable
	result.BackupPath = executable + ".old"
	result.Recovery = fmt.Sprintf("restore %q to %q", result.BackupPath, executable)

	lockPath := executable + ".upgrade.lock"
	lockToken, release, err := acquireTransaction(lockPath)
	if err != nil {
		return result, err
	}
	releaseOnReturn := true
	defer func() {
		if releaseOnReturn {
			release()
		}
	}()
	if _, err := os.Stat(result.BackupPath); err == nil {
		return result, fmt.Errorf("upgrade backup already exists at %s; rollback or remove it before upgrading", result.BackupPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return result, fmt.Errorf("inspect upgrade backup: %w", err)
	}

	emitProgress := func(progress DownloadProgress) {
		result.Progress = append(result.Progress, progress)
		if opts.Progress != nil {
			opts.Progress(progress)
		}
	}
	candidate, calculated, err := downloadCandidate(opts, filepath.Dir(executable), emitProgress)
	if err != nil {
		return result, err
	}
	defer func() {
		if candidate != "" {
			_ = os.Remove(candidate)
		}
	}()
	if calculated != expected {
		return result, fmt.Errorf("checksum mismatch: expected %s, got %s", expected, calculated)
	}
	verify := opts.Verify
	if verify == nil {
		verify = VerifyExecutable
	}
	replace := opts.Replace
	if replace == nil {
		replace = replaceExecutable
	}
	scheduled, err := replace(
		executable, candidate, result.BackupPath, result.TargetVersion, expected,
		lockPath, lockToken, verify,
	)
	if err != nil {
		return result, err
	}
	result.Scheduled = scheduled
	if scheduled {
		candidate = ""
		releaseOnReturn = false
	}
	if !scheduled {
		result.Recovery = ""
	}
	return result, nil
}

func downloadCandidate(opts UpgradeOptions, destinationDir string, emit func(DownloadProgress)) (string, string, error) {
	client := opts.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 2 * time.Minute}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, opts.DownloadURL, nil)
	if err != nil {
		return "", "", fmt.Errorf("create binary download request: %w", err)
	}
	response, err := client.Do(request)
	if err != nil {
		return "", "", fmt.Errorf("download update binary: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("download update binary returned %s", response.Status)
	}
	if response.ContentLength > maxBinaryBytes {
		return "", "", fmt.Errorf("update binary exceeds %d bytes", maxBinaryBytes)
	}
	file, err := os.CreateTemp(destinationDir, ".mirror-upgrade-*")
	if err != nil {
		return "", "", fmt.Errorf("create staged update binary: %w", err)
	}
	path := file.Name()
	remove := true
	defer func() {
		file.Close()
		if remove {
			os.Remove(path)
		}
	}()
	hasher := sha256.New()
	limited := io.LimitReader(response.Body, maxBinaryBytes+1)
	buffer := make([]byte, 256<<10)
	var written int64
	var lastPercent int
	var lastUnknownBytes int64
	var lastEmittedBytes int64
	for {
		count, readErr := limited.Read(buffer)
		if count > 0 {
			if _, err := file.Write(buffer[:count]); err != nil {
				return "", "", fmt.Errorf("write staged update binary: %w", err)
			}
			if _, err := hasher.Write(buffer[:count]); err != nil {
				return "", "", fmt.Errorf("hash staged update binary: %w", err)
			}
			written += int64(count)
			progress := DownloadProgress{Bytes: written, Total: response.ContentLength}
			shouldEmit := false
			if response.ContentLength > 0 {
				progress.Percent = float64(written) * 100 / float64(response.ContentLength)
				percent := int(progress.Percent)
				shouldEmit = percent >= lastPercent+5 || written == response.ContentLength
				if shouldEmit {
					lastPercent = percent
				}
			} else if written >= lastUnknownBytes+(1<<20) {
				shouldEmit = true
				lastUnknownBytes = written
			}
			if shouldEmit && emit != nil {
				emit(progress)
				lastEmittedBytes = written
			}
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return "", "", fmt.Errorf("read update binary: %w", readErr)
		}
	}
	if emit != nil && written != lastEmittedBytes {
		progress := DownloadProgress{Bytes: written, Total: response.ContentLength}
		if response.ContentLength > 0 {
			progress.Percent = float64(written) * 100 / float64(response.ContentLength)
		}
		emit(progress)
	}
	if written > maxBinaryBytes {
		return "", "", fmt.Errorf("update binary exceeds %d bytes", maxBinaryBytes)
	}
	if err := file.Sync(); err != nil {
		return "", "", fmt.Errorf("sync staged update binary: %w", err)
	}
	if err := file.Close(); err != nil {
		return "", "", fmt.Errorf("close staged update binary: %w", err)
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(path, 0o755); err != nil {
			return "", "", fmt.Errorf("make staged update executable: %w", err)
		}
	}
	remove = false
	return path, hex.EncodeToString(hasher.Sum(nil)), nil
}

func FetchChecksum(ctx context.Context, client *http.Client, manifestURL, assetName string) (string, error) {
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return "", fmt.Errorf("create checksum request: %w", err)
	}
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("download checksums: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download checksums returned %s", response.Status)
	}
	content, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	if err != nil {
		return "", fmt.Errorf("read checksums: %w", err)
	}
	if len(content) > 1<<20 {
		return "", fmt.Errorf("checksums.txt exceeds %d bytes", 1<<20)
	}
	for _, line := range strings.Split(string(content), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && strings.TrimPrefix(fields[1], "*") == assetName {
			checksum := strings.ToLower(fields[0])
			if len(checksum) != sha256.Size*2 {
				break
			}
			if _, err := hex.DecodeString(checksum); err == nil {
				return checksum, nil
			}
		}
	}
	return "", fmt.Errorf("checksums.txt does not contain a valid checksum for %s", assetName)
}

func acquireTransaction(path string) (string, func(), error) {
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", nil, fmt.Errorf("create upgrade transaction token: %w", err)
	}
	token := hex.EncodeToString(random)
	file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if errors.Is(err, os.ErrExist) {
		if info, statErr := os.Stat(path); statErr == nil && time.Since(info.ModTime()) > transactionMaxAge {
			if removeErr := os.Remove(path); removeErr == nil {
				file, err = os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
			}
		}
		if errors.Is(err, os.ErrExist) {
			return "", nil, fmt.Errorf("another Mirror upgrade transaction is active: %s", path)
		}
	}
	if err != nil {
		return "", nil, fmt.Errorf("create upgrade transaction: %w", err)
	}
	if _, err := fmt.Fprintln(file, token); err != nil {
		file.Close()
		os.Remove(path)
		return "", nil, fmt.Errorf("write upgrade transaction: %w", err)
	}
	if err := file.Close(); err != nil {
		os.Remove(path)
		return "", nil, fmt.Errorf("close upgrade transaction: %w", err)
	}
	return token, func() {
		content, err := os.ReadFile(path)
		if err == nil && strings.TrimSpace(string(content)) == token {
			_ = os.Remove(path)
		}
	}, nil
}
