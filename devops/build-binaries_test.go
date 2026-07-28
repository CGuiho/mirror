package main

import (
	"archive/zip"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/CGuiho/mirror/pkg/release"
)

func TestBuildEnvironmentClearsUnrelatedArchitectureTuning(t *testing.T) {
	t.Setenv("GOAMD64", "v4")
	t.Setenv("GOARM64", "v9.0")
	t.Setenv("GOARM", "5")
	target := release.Target{Name: "mirror-linux-armv6", GOOS: "linux", GOARCH: "arm", Tuning: "GOARM=6"}
	environment := buildEnvironment(target)
	assertEnvironmentValue(t, environment, "CGO_ENABLED", "0")
	assertEnvironmentValue(t, environment, "GOOS", "linux")
	assertEnvironmentValue(t, environment, "GOARCH", "arm")
	assertEnvironmentValue(t, environment, "GOARM", "6")
	for _, item := range environment {
		if strings.HasPrefix(item, "GOAMD64=") || strings.HasPrefix(item, "GOARM64=") {
			t.Fatalf("unrelated tuning leaked into ARM build: %s", item)
		}
	}
}

func TestSkillArchiveUsesCanonicalPathAndStableTimestamp(t *testing.T) {
	root := t.TempDir()
	skillDir := filepath.Join(root, "embed", "skills", "guiho-s-mirror")
	if err := os.MkdirAll(skillDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: guiho-s-mirror\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	modified := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	path := filepath.Join(root, "skill.zip")
	if err := writeSkillZip(root, path, modified); err != nil {
		t.Fatal(err)
	}
	archive, err := zip.OpenReader(path)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()
	if len(archive.File) != 1 || archive.File[0].Name != "guiho-s-mirror/SKILL.md" {
		t.Fatalf("unexpected archive entries: %#v", archive.File)
	}
	if !archive.File[0].Modified.Equal(modified) {
		t.Fatalf("unexpected archive timestamp: %s", archive.File[0].Modified)
	}
}

func TestWorkflowAndInstallerContractsAreGoAuthoritative(t *testing.T) {
	root := filepath.Dir(mustWorkingDirectory(t))
	ci := normalizedFile(t, filepath.Join(root, ".github", "workflows", "ci.yml"))
	publish := normalizedFile(t, filepath.Join(root, ".github", "workflows", "publish.yml"))
	installSh := normalizedFile(t, filepath.Join(root, "devops", "install.sh"))
	installPS := normalizedFile(t, filepath.Join(root, "devops", "install.ps1"))

	for _, text := range []string{ci, publish} {
		for _, required := range []string{"go test", "go vet", "devops/build-binaries.go", "verify-release-assets"} {
			if !strings.Contains(text, required) {
				t.Fatalf("workflow is missing %q", required)
			}
		}
		if strings.Contains(strings.ToLower(text), "bun ") || strings.Contains(text, "fourteen") {
			t.Fatal("legacy Bun/fourteen-asset workflow authority remains")
		}
	}
	if !strings.Contains(ci, "'mirror/v*'") || !strings.Contains(publish, "'mirror/v*'") {
		t.Fatal("canonical Mirror Go tag trigger is missing")
	}
	for _, name := range release.AssetNames() {
		if name == "checksums.txt" {
			continue
		}
		if !strings.Contains(installSh+installPS+ci+publish, name) && strings.HasPrefix(name, "mirror-") {
			t.Fatalf("release target is disconnected from delivery contract: %s", name)
		}
	}
	for _, text := range []string{installSh, installPS} {
		if !strings.Contains(text, "checksums.txt") || !strings.Contains(text, "guiho-s-mirror.zip") {
			t.Fatal("installer does not consume checksums and skill ZIP")
		}
	}
	if !slices.IsSorted(release.AssetNames()) {
		t.Fatal("release asset names must be deterministic")
	}
	if !strings.Contains(ci, "$installerSource | Invoke-Expression") {
		t.Fatal("Windows installer CI does not exercise the Invoke-Expression entrypoint")
	}
	for _, required := range []string{"Get-MirrorRequiredText", "Mirror installer failed during ${installerStage}"} {
		if !strings.Contains(installPS, required) {
			t.Fatalf("PowerShell installer is missing null-safe stage handling: %s", required)
		}
	}
}

func TestPowerShellInstallerInvokeExpressionReportsStage(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("PowerShell installer regression requires Windows")
	}
	root := filepath.Dir(mustWorkingDirectory(t))
	installer := filepath.Join(root, "devops", "install.ps1")
	installDir := filepath.Join(t.TempDir(), "must-not-exist")
	commandText := strings.Join([]string{
		"$env:MIRROR_TEST_ARCH=' '",
		"$env:MIRROR_VERSION='0.0.0-test'",
		"$env:MIRROR_HOME_DIR=" + powerShellLiteral(t.TempDir()),
		"$env:MIRROR_INSTALL_DIR=" + powerShellLiteral(installDir),
		"$env:MIRROR_SKIP_PATH_UPDATE='1'",
		"Get-Content -Raw -LiteralPath " + powerShellLiteral(installer) + " | Invoke-Expression",
	}, "; ")
	command := exec.Command("powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", commandText)
	output, err := command.CombinedOutput()
	if err == nil {
		t.Fatalf("installer unexpectedly accepted an empty architecture:\n%s", output)
	}
	expected := "Mirror installer failed during architecture detection: Windows architecture is missing or empty."
	if !strings.Contains(string(output), expected) {
		t.Fatalf("installer failure did not identify its stage:\n%s", output)
	}
	if _, statErr := os.Stat(installDir); !os.IsNotExist(statErr) {
		t.Fatalf("failed pre-install validation created the install directory: %v", statErr)
	}
}

func assertEnvironmentValue(t *testing.T, environment []string, key, expected string) {
	t.Helper()
	for _, item := range environment {
		name, value, found := strings.Cut(item, "=")
		if found && name == key {
			if value != expected {
				t.Fatalf("%s=%s, expected %s", key, value, expected)
			}
			return
		}
	}
	t.Fatalf("missing environment key %s", key)
}

func mustWorkingDirectory(t *testing.T) string {
	t.Helper()
	directory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	return directory
}

func normalizedFile(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return strings.ReplaceAll(string(content), "\r\n", "\n")
}

func powerShellLiteral(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}
