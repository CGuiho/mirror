package launcher

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInstallActivateAndRestoreImmutablePayload(t *testing.T) {
	paths, err := ResolvePaths(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	firstSource, firstChecksum := fixturePayload(t, paths.UserHome, "first")
	first, firstPath, err := InstallPayload(paths, firstSource, "4.2.6", firstChecksum)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Activate(paths, first); err != nil {
		t.Fatal(err)
	}
	secondSource, secondChecksum := fixturePayload(t, paths.UserHome, "second")
	second, _, err := InstallPayload(paths, secondSource, "4.2.7", secondChecksum)
	if err != nil {
		t.Fatal(err)
	}
	previous, err := Activate(paths, second)
	if err != nil {
		t.Fatal(err)
	}
	state, err := ReadState(paths)
	if err != nil {
		t.Fatal(err)
	}
	if state.Active.Version != "4.2.7" || state.Previous == nil || state.Previous.Version != "4.2.6" {
		t.Fatalf("unexpected activated state: %+v", state)
	}
	if err := Restore(paths, previous); err != nil {
		t.Fatal(err)
	}
	restored, err := ReadState(paths)
	if err != nil {
		t.Fatal(err)
	}
	if restored.Active.Version != "4.2.6" {
		t.Fatalf("restored active version = %q", restored.Active.Version)
	}
	if observed, err := os.ReadFile(firstPath); err != nil || string(observed) != "first" {
		t.Fatalf("immutable first payload changed: %q, %v", observed, err)
	}
}

func TestReadStateRejectsUnknownFieldsAndEscapingPaths(t *testing.T) {
	paths, err := ResolvePaths(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(paths.CLIHome, 0o755); err != nil {
		t.Fatal(err)
	}
	checksum := strings.Repeat("a", 64)
	cases := []string{
		`{"schema":1,"active":{"version":"1.0.0","relativePath":"versions/1.0.0/mirror","sha256":"` + checksum + `"},"unknown":true}`,
		`{"schema":1,"active":{"version":"1.0.0","relativePath":"../outside","sha256":"` + checksum + `"}}`,
		`{"schema":1,"active":{"version":"1.0.0","relativePath":"/absolute","sha256":"` + checksum + `"}}`,
	}
	for _, content := range cases {
		if err := os.WriteFile(paths.CurrentState, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := ReadState(paths); err == nil {
			t.Fatalf("expected invalid state rejection: %s", content)
		}
	}
}

func TestEntryForUsesVersionedRelativePayload(t *testing.T) {
	checksum := strings.Repeat("b", 64)
	entry, err := EntryFor("v4.2.6", checksum)
	if err != nil {
		t.Fatal(err)
	}
	if entry.Version != "4.2.6" || !strings.HasPrefix(entry.RelativePath, "versions/4.2.6/mirror") {
		t.Fatalf("unexpected entry: %+v", entry)
	}
	for _, version := range []string{"", "../4.2.6", `4.2\\6`} {
		if _, err := EntryFor(version, checksum); err == nil {
			t.Fatalf("expected invalid version rejection: %q", version)
		}
	}
}

func fixturePayload(t *testing.T, directory, content string) (string, string) {
	t.Helper()
	path := filepath.Join(directory, "source-"+content)
	if err := os.WriteFile(path, []byte(content), 0o755); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256([]byte(content))
	return path, hex.EncodeToString(digest[:])
}
