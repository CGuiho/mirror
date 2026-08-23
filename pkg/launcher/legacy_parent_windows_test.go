//go:build windows

package launcher

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestLegacyDecoratedVersionProbeDetectsV424Helper(t *testing.T) {
	if os.Getenv("MIRROR_LEGACY_BRIDGE_ROLE") != "" {
		runLegacyBridgeFixtureProcess()
		return
	}
	directory := t.TempDir()
	testExecutable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	helper := filepath.Join(directory, ".mirror-upgrade-helper-fixture.exe")
	candidate := filepath.Join(directory, "mirror.exe")
	copyTestExecutable(t, testExecutable, helper)
	copyTestExecutable(t, testExecutable, candidate)
	oldSource := filepath.Join(directory, "old.go")
	if err := os.WriteFile(oldSource, []byte("package main\nimport \"fmt\"\nfunc main(){fmt.Println(\"mirror v4.2.4\")}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	old := candidate + ".old"
	build := exec.Command("go", "build", "-o", old, oldSource)
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build legacy version fixture: %v\n%s", err, output)
	}
	command := exec.Command(helper, "-test.run=TestLegacyDecoratedVersionProbeDetectsV424Helper")
	command.Env = append(os.Environ(),
		"MIRROR_LEGACY_BRIDGE_ROLE=parent",
		"MIRROR_LEGACY_BRIDGE_CANDIDATE="+candidate,
	)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("run helper fixture: %v\n%s", err, output)
	}
	if strings.TrimSpace(string(output)) != "true" {
		t.Fatalf("legacy bridge detection = %q, expected true", output)
	}
}

func runLegacyBridgeFixtureProcess() {
	switch os.Getenv("MIRROR_LEGACY_BRIDGE_ROLE") {
	case "parent":
		candidate := os.Getenv("MIRROR_LEGACY_BRIDGE_CANDIDATE")
		command := exec.Command(candidate, "-test.run=TestLegacyDecoratedVersionProbeDetectsV424Helper")
		command.Env = append(os.Environ(), "MIRROR_LEGACY_BRIDGE_ROLE=candidate")
		output, err := command.CombinedOutput()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		_, _ = os.Stdout.Write(output)
		os.Exit(0)
	case "candidate":
		fmt.Println(usesLegacyDecoratedVersionProbe(os.Getenv("MIRROR_LEGACY_BRIDGE_CANDIDATE")))
		os.Exit(0)
	default:
		os.Exit(2)
	}
}

func copyTestExecutable(t *testing.T, source, destination string) {
	t.Helper()
	content, err := os.ReadFile(source)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(destination, content, 0o755); err != nil {
		t.Fatal(err)
	}
}
