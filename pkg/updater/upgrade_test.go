package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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
	}

	// Upgrade
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

	// Verify rollback availability
	if !CanRollback(originalExec) {
		t.Error("Expected CanRollback to return true after upgrade")
	}

	// Test Rollback
	err = PerformRollback(originalExec)
	if err != nil {
		t.Fatalf("PerformRollback failed: %v", err)
	}

	// Verify rolled-back binary content
	rolledBackData, err := os.ReadFile(originalExec)
	if err != nil {
		t.Fatalf("Failed to read rolled-back binary: %v", err)
	}
	if string(rolledBackData) != string(initialContent) {
		t.Errorf("Expected rolled back content %q, got %q", string(initialContent), string(rolledBackData))
	}
}

func TestGetTargetAssetName(t *testing.T) {
	tests := []struct {
		goos     string
		goarch   string
		expected string
	}{
		{"windows", "amd64", "mirror-windows-x64.exe"},
		{"linux", "amd64", "mirror-linux-x64"},
		{"darwin", "arm64", "mirror-darwin-arm64"},
	}

	for _, tt := range tests {
		res := GetTargetAssetName(tt.goos, tt.goarch)
		if res != tt.expected {
			t.Errorf("GetTargetAssetName(%s, %s) = %s; want %s", tt.goos, tt.goarch, res, tt.expected)
		}
	}
}
