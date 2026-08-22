package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPerformSelfUpgradeAndRollback(t *testing.T) {
	tempDir := t.TempDir()
	originalExec := filepath.Join(tempDir, "mirror.exe")

	initialContent := []byte("original binary content v3.7.3")
	if err := os.WriteFile(originalExec, initialContent, 0755); err != nil {
		t.Fatalf("Failed to write initial binary: %v", err)
	}

	newBinaryContent := []byte("new binary content v3.8.0")
	hasher := sha256.New()
	hasher.Write(newBinaryContent)
	expectedChecksum := hex.EncodeToString(hasher.Sum(nil))

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.WriteHeader(http.StatusOK)
		w.Write(newBinaryContent)
	}))
	defer server.Close()

	opts := UpgradeOptions{
		CurrentExecutablePath: originalExec,
		TargetVersion:         "3.8.0",
		DownloadURL:           server.URL,
		ExpectedChecksum:      expectedChecksum,
		HTTPClient:            server.Client(),
		Progress: func(progress DownloadProgress) {
			if progress.Bytes <= 0 {
				t.Fatal("progress must report downloaded bytes")
			}
		},
		Verify: func(string, string) error { return nil },
		Replace: func(executable, candidate, _, _, _, _, _ string, _ VerifyFunc) (bool, error) {
			// Just overwrite — mirrors installer behavior, no backup.
			_ = os.Remove(executable)
			if err := os.Rename(candidate, executable); err != nil {
				return false, err
			}
			return false, nil
		},
	}

	// Upgrade — should just overwrite, no .old retained.
	err := PerformSelfUpgrade(opts)
	if err != nil {
		t.Fatalf("PerformSelfUpgrade failed: %v", err)
	}

	// Verify upgraded executable content
	currentData, err := os.ReadFile(originalExec)
	if err != nil {
		t.Fatalf("Failed to read upgraded binary: %v", err)
	}
	if string(currentData) != string(newBinaryContent) {
		t.Errorf("Expected upgraded binary content %q, got %q", string(newBinaryContent), string(currentData))
	}

	// No backup retained — rollback must be unavailable.
	if CanRollback(originalExec) {
		t.Error("Expected CanRollback to return false after overwrite upgrade")
	}
	if _, err := PerformRollback(originalExec); err == nil {
		t.Fatal("expected PerformRollback to fail without backup")
	}
	if _, err := os.Stat(originalExec + ".old"); !os.IsNotExist(err) {
		t.Fatalf("expected no .old backup, got stat err: %v", err)
	}
}

func TestTargetAssetPreservesEmbeddedARMVariant(t *testing.T) {
	for target, expected := range map[string]string{
		"mirror-linux-armv6":       "mirror-linux-armv6",
		"mirror-linux-armv7":       "mirror-linux-armv7",
		"mirror-linux-arm64":       "mirror-linux-arm64",
		"mirror-windows-arm64.exe": "mirror-windows-arm64.exe",
	} {
		observed, err := TargetAsset(target)
		if err != nil {
			t.Fatal(err)
		}
		if observed != expected {
			t.Fatalf("TargetAsset(%q) = %q, expected %q", target, observed, expected)
		}
	}
}

func TestFetchChecksumRequiresNamedSHA256(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  mirror-linux-amd64")
		fmt.Fprintln(w, "not-a-checksum  mirror-linux-arm64")
	}))
	defer server.Close()
	checksum, err := FetchChecksum(context.Background(), server.Client(), server.URL, "mirror-linux-amd64")
	if err != nil {
		t.Fatal(err)
	}
	if checksum != strings.Repeat("a", 64) {
		t.Fatalf("unexpected checksum %q", checksum)
	}
	if _, err := FetchChecksum(context.Background(), server.Client(), server.URL, "mirror-linux-arm64"); err == nil {
		t.Fatal("expected malformed checksum rejection")
	}
}

func TestUpgradeTransactionIsExclusiveAndTokenOwned(t *testing.T) {
	path := filepath.Join(t.TempDir(), "upgrade.lock")
	token, release, err := acquireTransaction(path)
	if err != nil {
		t.Fatal(err)
	}
	if token == "" {
		t.Fatal("expected transaction token")
	}
	if _, _, err := acquireTransaction(path); err == nil {
		t.Fatal("expected concurrent transaction rejection")
	}
	if err := os.WriteFile(path, []byte("other-token\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	release()
	if _, err := os.Stat(path); err != nil {
		t.Fatal("owner removed a lock after its token changed")
	}
}

func TestGetTargetAssetName(t *testing.T) {
	tests := []struct {
		goos     string
		goarch   string
		expected string
	}{
		{"windows", "amd64", "mirror-windows-amd64.exe"},
		{"linux", "amd64", "mirror-linux-amd64"},
		{"darwin", "arm64", "mirror-darwin-arm64"},
	}

	for _, tt := range tests {
		res := GetTargetAssetName(tt.goos, tt.goarch)
		if res != tt.expected {
			t.Errorf("GetTargetAssetName(%s, %s) = %s; want %s", tt.goos, tt.goarch, res, tt.expected)
		}
	}
}
