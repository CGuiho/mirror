package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/CGuiho/mirror/pkg/launcher"
)

func TestNativeStableLauncherUpgradeIsSynchronous(t *testing.T) {
	home := t.TempDir()
	t.Setenv("MIRROR_HOME_DIR", home)
	paths, err := launcher.ResolvePaths(home)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(paths.SharedBin, 0o755); err != nil {
		t.Fatal(err)
	}
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	firstBuild := filepath.Join(home, executableName("mirror-first"))
	secondBuild := filepath.Join(home, executableName("mirror-second"))
	buildFixtureBinary(t, root, firstBuild, "4.2.6")
	buildFixtureBinary(t, root, secondBuild, "4.2.7")
	firstChecksum, err := launcher.FileSHA256(firstBuild)
	if err != nil {
		t.Fatal(err)
	}
	first, firstPayload, err := launcher.InstallPayload(paths, firstBuild, "4.2.6", firstChecksum)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := launcher.Activate(paths, first); err != nil {
		t.Fatal(err)
	}
	copyExecutable(t, firstBuild, paths.Launcher)
	if err := os.WriteFile(paths.Launcher+".old", []byte("stale"), 0o600); err != nil {
		t.Fatal(err)
	}
	assertExecutableVersion(t, paths.Launcher, "4.2.6")
	if _, err := os.Stat(paths.Launcher + ".old"); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("legacy .old was not removed after verified launcher dispatch: %v", err)
	}
	assertDelegatedExitCode(t, paths.Launcher, 2, "definitely-not-a-command")

	candidate, err := os.ReadFile(secondBuild)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(candidate)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(candidate)
	}))
	defer server.Close()
	result, err := Upgrade(UpgradeOptions{
		CurrentExecutablePath: firstPayload,
		UserHome:              home,
		TargetVersion:         "4.2.7",
		DownloadURL:           server.URL,
		ExpectedChecksum:      hex.EncodeToString(digest[:]),
		HTTPClient:            server.Client(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.LegacyTransition {
		t.Fatalf("upgrade was not synchronous: %+v", result)
	}
	assertExecutableVersion(t, paths.Launcher, "4.2.7")
	state, err := launcher.ReadState(paths)
	if err != nil {
		t.Fatal(err)
	}
	if state.Active.Version != "4.2.7" || state.Previous == nil || state.Previous.Version != "4.2.6" {
		t.Fatalf("unexpected final launcher state: %+v", state)
	}
	if _, err := os.Stat(firstPayload); err != nil {
		t.Fatalf("previous immutable payload was not retained: %v", err)
	}
}

func buildFixtureBinary(t *testing.T, root, output, version string) {
	t.Helper()
	command := exec.Command("go", "build", "-trimpath", "-o", output, "-ldflags", strings.Join([]string{
		"-X", "main.version=" + version,
		"-X", "main.commit=fixture",
		"-X", "main.buildDate=2026-08-23T00:00:00Z",
		"-X", "main.buildTarget=" + GetCurrentTargetAssetName(),
	}, " "), ".")
	command.Dir = root
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("build fixture %s: %v\n%s", version, err, output)
	}
}

func assertExecutableVersion(t *testing.T, path, expected string) {
	t.Helper()
	command := exec.Command(path, "--version")
	command.Env = append(os.Environ(), "MIRROR_DISABLE_UPDATE_CHECK=1")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("run %s --version: %v\n%s", path, err, output)
	}
	if observed := strings.TrimSpace(string(output)); observed != expected {
		t.Fatalf("version = %q, expected %q", observed, expected)
	}
}

func assertDelegatedExitCode(t *testing.T, path string, expected int, arguments ...string) {
	t.Helper()
	command := exec.Command(path, arguments...)
	command.Env = append(os.Environ(), "MIRROR_DISABLE_UPDATE_CHECK=1")
	err := command.Run()
	var exitError *exec.ExitError
	if !errors.As(err, &exitError) {
		t.Fatalf("expected delegated exit error, got %v", err)
	}
	if exitError.ExitCode() != expected {
		t.Fatalf("delegated exit = %d, expected %d", exitError.ExitCode(), expected)
	}
}

func copyExecutable(t *testing.T, source, destination string) {
	t.Helper()
	content, err := os.ReadFile(source)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(destination, content, 0o755); err != nil {
		t.Fatal(err)
	}
}

func executableName(base string) string {
	if runtime.GOOS == "windows" {
		return base + ".exe"
	}
	return base
}
