package maintenance

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEnsureSkillFile(t *testing.T) {
	tempDir := t.TempDir()
	targetPath := filepath.Join(tempDir, "skills", "test-skill", "SKILL.md")
	content := []byte("# Test Skill")

	// First write: file should be created
	updated, err := EnsureSkillFile(targetPath, content)
	if err != nil {
		t.Fatalf("EnsureSkillFile failed: %v", err)
	}
	if !updated {
		t.Error("Expected updated to be true on new file creation")
	}

	// Second write with same content: should not be updated
	updated, err = EnsureSkillFile(targetPath, content)
	if err != nil {
		t.Fatalf("EnsureSkillFile failed on second write: %v", err)
	}
	if updated {
		t.Error("Expected updated to be false on unchanged content")
	}

	// Third write with new content: should be updated
	newContent := []byte("# Test Skill Updated")
	updated, err = EnsureSkillFile(targetPath, newContent)
	if err != nil {
		t.Fatalf("EnsureSkillFile failed on update write: %v", err)
	}
	if !updated {
		t.Error("Expected updated to be true on content change")
	}
}

func TestFindAgentsMD(t *testing.T) {
	tempDir := t.TempDir()
	subDir := filepath.Join(tempDir, "a", "b", "c")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("Failed to create subDir: %v", err)
	}

	agentsFile := filepath.Join(tempDir, "AGENTS.md")
	if err := os.WriteFile(agentsFile, []byte("Root AGENTS"), 0644); err != nil {
		t.Fatalf("Failed to write root AGENTS.md: %v", err)
	}

	found, err := FindAgentsMD(subDir)
	if err != nil {
		t.Fatalf("FindAgentsMD failed: %v", err)
	}

	if found != agentsFile {
		t.Errorf("Expected found path %s, got %s", agentsFile, found)
	}
}
