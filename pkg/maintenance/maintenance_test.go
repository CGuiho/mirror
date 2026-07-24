package maintenance

import (
	"embed"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Dummy embedded filesystem for test
//
//go:embed storage.go
var testFS embed.FS

func TestUpdateAGENTSBlock(t *testing.T) {
	tempDir := t.TempDir()
	agentsFile := filepath.Join(tempDir, "AGENTS.md")

	initialContent := "# Main Project\n\nSome intro text.\n"
	if err := os.WriteFile(agentsFile, []byte(initialContent), 0644); err != nil {
		t.Fatalf("Failed to write initial AGENTS.md: %v", err)
	}

	block1 := "Skill GUIHO Mirror v3.8.0"
	err := UpdateAGENTSBlock(agentsFile, block1)
	if err != nil {
		t.Fatalf("UpdateAGENTSBlock failed: %v", err)
	}

	content1, _ := ReadAGENTSFile(agentsFile)
	if !strings.Contains(content1, BlockBeginMarker) || !strings.Contains(content1, block1) {
		t.Errorf("Expected content to contain block1, got: %s", content1)
	}

	// Update block idempotently
	block2 := "Skill GUIHO Mirror v3.9.0"
	err = UpdateAGENTSBlock(agentsFile, block2)
	if err != nil {
		t.Fatalf("UpdateAGENTSBlock idempotent update failed: %v", err)
	}

	content2, _ := ReadAGENTSFile(agentsFile)
	if strings.Contains(content2, block1) {
		t.Errorf("Expected old block1 to be replaced, but it was found in: %s", content2)
	}
	if !strings.Contains(content2, block2) {
		t.Errorf("Expected content to contain block2, got: %s", content2)
	}
}

func TestReconcileAgentSkills(t *testing.T) {
	tempDir := t.TempDir()
	err := ReconcileAgentSkills(testFS, tempDir)
	if err != nil {
		t.Fatalf("ReconcileAgentSkills failed: %v", err)
	}
}
