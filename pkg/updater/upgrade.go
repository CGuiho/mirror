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

	"github.com/CGuiho/mirror/pkg/launcher"
)

const maxBinaryBytes int64 = 256 << 20
const transactionMaxAge = 10 * time.Minute

type VerifyFunc func(path, targetVersion string) error
type SelfTestFunc func(path string) error
type ReplaceFunc func(executable, candidate, backup, targetVersion, checksum, lockPath, lockToken string, verify VerifyFunc) (bool, error)

type UpgradeOptions struct {
	CurrentExecutablePath string
	UserHome              string
	TargetVersion         string
	DownloadURL           string
	ExpectedChecksum      string
	HTTPClient            *http.Client
	Verify                VerifyFunc
	SelfTest              SelfTestFunc
	Replace               ReplaceFunc
	Progress              func(DownloadProgress)
}

type DownloadProgress struct {
	Bytes   int64   `json:"bytes"`
	Total   int64   `json:"total,omitempty"`
	Percent float64 `json:"percent,omitempty"`
}

type UpgradeResult struct {
	ExecutablePath   string             `json:"executablePath"`
	PayloadPath      string             `json:"payloadPath,omitempty"`
	PreviousVersion  string             `json:"previousVersion,omitempty"`
	BackupPath       string             `json:"backupPath,omitempty"`
	TargetVersion    string             `json:"targetVersion"`
	LegacyTransition bool               `json:"legacyTransition,omitempty"`
	Recovery         string             `json:"recovery,omitempty"`
	Progress         []DownloadProgress `json:"progress,omitempty"`
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
	result.BackupPath = ""
	result.Recovery = ""

	var paths launcher.Paths
	if opts.UserHome != "" {
		paths, err = launcher.ResolvePaths(opts.UserHome)
	} else {
		paths, err = launcher.UserPaths()
	}
	if err != nil {
		return result, err
	}
	if err := os.MkdirAll(paths.CLIHome, 0o755); err != nil {
		return result, fmt.Errorf("create Mirror home: %w", err)
	}
	if err := os.MkdirAll(paths.SharedTemp, 0o755); err != nil {
		return result, fmt.Errorf("create shared GUIHO temporary directory: %w", err)
	}
	lockPath := paths.UpgradeLock
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

	operationDir, err := os.MkdirTemp(paths.SharedTemp, "mirror-upgrade-")
	if err != nil {
		return result, fmt.Errorf("create confined upgrade staging directory: %w", err)
	}
	removeOperationDir := true
	defer func() {
		if removeOperationDir {
			_ = os.RemoveAll(operationDir)
		}
	}()
	emitProgress := func(progress DownloadProgress) {
		result.Progress = append(result.Progress, progress)
		if opts.Progress != nil {
			opts.Progress(progress)
		}
	}
	candidate, calculated, err := downloadCandidate(opts, operationDir, emitProgress)
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
	if err := verify(candidate, result.TargetVersion); err != nil {
		return result, fmt.Errorf("verify staged update: %w", err)
	}
	selfTest := opts.SelfTest
	if selfTest == nil {
		selfTest = VerifySelfTest
	}
	if err := selfTest(candidate); err != nil {
		return result, fmt.Errorf("self-test staged update: %w", err)
	}

	state, stateErr := launcher.ReadState(paths)
	if stateErr == nil {
		activePath, pathErr := launcher.PayloadPath(paths, state.Active)
		if pathErr != nil {
			return result, pathErr
		}
		if !sameExecutablePath(executable, activePath) {
			return result, fmt.Errorf("running executable is not the active launcher payload: %s", executable)
		}
		entry, payloadPath, installErr := launcher.InstallPayload(paths, candidate, result.TargetVersion, expected)
		if installErr != nil {
			return result, installErr
		}
		previousState, activateErr := launcher.Activate(paths, entry)
		if activateErr != nil {
			return result, fmt.Errorf("activate launcher payload: %w", activateErr)
		}
		if verifyErr := verify(paths.Launcher, result.TargetVersion); verifyErr != nil {
			if restoreErr := launcher.Restore(paths, previousState); restoreErr != nil {
				return result, fmt.Errorf("verify activated launcher payload: %w; restore previous pointer: %v", verifyErr, restoreErr)
			}
			return result, fmt.Errorf("verify activated launcher payload: %w; previous pointer restored", verifyErr)
		}
		if selfTestErr := selfTest(paths.Launcher); selfTestErr != nil {
			if restoreErr := launcher.Restore(paths, previousState); restoreErr != nil {
				return result, fmt.Errorf("self-test activated launcher payload: %w; restore previous pointer: %v", selfTestErr, restoreErr)
			}
			return result, fmt.Errorf("self-test activated launcher payload: %w; previous pointer restored", selfTestErr)
		}
		result.ExecutablePath = paths.Launcher
		result.PayloadPath = payloadPath
		if previousState != nil {
			result.PreviousVersion = previousState.Active.Version
		}
		return result, nil
	}
	if !errors.Is(stateErr, os.ErrNotExist) {
		return result, fmt.Errorf("read launcher state before upgrade: %w", stateErr)
	}

	// A direct legacy installation must transition once to the stable launcher.
	// Unix can replace the unlinked running image synchronously. Windows must use
	// the legacy helper because the running executable is locked; the candidate
	// bootstraps current.json and its immutable payload during helper verification.
	replace := opts.Replace
	if replace == nil {
		replace = replaceExecutable
	}
	legacyAsync, err := replace(
		executable, candidate, "", result.TargetVersion, expected,
		lockPath, lockToken, verify,
	)
	if err != nil {
		return result, err
	}
	result.LegacyTransition = legacyAsync
	if !legacyAsync {
		_ = os.Remove(executable + ".old")
	}
	if legacyAsync {
		candidate = ""
		releaseOnReturn = false
		removeOperationDir = false
	}
	return result, nil
}

func sameExecutablePath(left, right string) bool {
	leftAbs, leftErr := filepath.Abs(left)
	rightAbs, rightErr := filepath.Abs(right)
	if leftErr != nil || rightErr != nil {
		return false
	}
	leftAbs = filepath.Clean(leftAbs)
	rightAbs = filepath.Clean(rightAbs)
	if runtime.GOOS == "windows" {
		return strings.EqualFold(leftAbs, rightAbs)
	}
	return leftAbs == rightAbs
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
