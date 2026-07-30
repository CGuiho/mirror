package maintenance

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	embedFS "github.com/CGuiho/mirror/embed"
)

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
	err := ReconcileAgentSkills(embedFS.FS, tempDir)
	if err != nil {
		t.Fatalf("ReconcileAgentSkills failed: %v", err)
	}
	for _, tool := range []string{".agents", ".claude"} {
		path := filepath.Join(tempDir, tool, "skills", SkillName, "SKILL.md")
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("expected transactional skill at %s: %v", path, err)
		}
	}
}

func TestInstructionsPreserveCRLFAndRemoveDuplicateBlocks(t *testing.T) {
	tempDir := t.TempDir()
	path := filepath.Join(tempDir, "AGENTS.md")
	initial := "prefix\r\n\r\n" + BlockBeginMarker + "\r\nold\r\n" + BlockEndMarker +
		"\r\nmiddle\r\n" + BlockBeginMarker + "\r\nold2\r\n" + BlockEndMarker + "\r\nsuffix\r\n"
	if err := os.WriteFile(path, []byte(initial), 0o644); err != nil {
		t.Fatal(err)
	}
	results, err := ApplyInstructions(embedFS.FS, tempDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || !results[0].Changed {
		t.Fatalf("unexpected instruction result: %#v", results)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(content)
	if strings.Count(text, BlockBeginMarker) != 1 || !strings.Contains(text, "prefix\r\n") || !strings.Contains(text, "\r\nsuffix\r\n") {
		t.Fatalf("instruction reconciliation did not preserve unmanaged CRLF content: %q", text)
	}
	expectedBody := BlockBeginMarker + "\r\n## GUIHO Mirror Instruction Block\r\n"
	if !strings.Contains(text, expectedBody) {
		t.Fatalf("managed instruction did not begin with the canonical body: %q", text)
	}
	managed := text[strings.Index(text, BlockBeginMarker):strings.Index(text, BlockEndMarker)]
	if strings.Contains(managed, "\r\n---\r\n") || strings.Contains(managed, "name: guiho-i-mirror") {
		t.Fatalf("managed instruction contains release frontmatter: %q", managed)
	}
	if strings.Contains(text, "\r\n\r\n"+BlockEndMarker) {
		t.Fatalf("managed instruction has a blank line before the end marker: %q", text)
	}
}

func TestInstructionBodyRequiresClosedFrontmatterAndContent(t *testing.T) {
	for _, test := range []struct {
		name    string
		content string
		message string
	}{
		{name: "missing", content: "## Body\n", message: "frontmatter is missing"},
		{name: "unclosed", content: "---\nname: guiho-i-mirror\n", message: "frontmatter is not closed"},
		{name: "empty", content: "---\nname: guiho-i-mirror\n---\n", message: "body is empty"},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := instructionBody(test.content)
			if err == nil || !strings.Contains(err.Error(), test.message) {
				t.Fatalf("expected %q, got %v", test.message, err)
			}
		})
	}
}

func TestMalformedInstructionBlockFailsWithoutMutation(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "AGENTS.md")
	content := "prefix\n" + BlockBeginMarker + "\nunclosed\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ApplyInstructions(embedFS.FS, root); err == nil || !strings.Contains(err.Error(), "malformed Mirror markers") {
		t.Fatalf("expected malformed marker error, got %v", err)
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != content {
		t.Fatalf("malformed file changed: %q", after)
	}
}

func TestSkillReconciliationDoesNotRewriteCurrentFiles(t *testing.T) {
	root := t.TempDir()
	if err := ReconcileAgentSkills(embedFS.FS, root); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, ".agents", "skills", SkillName, "SKILL.md")
	before, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	results, err := InstallAgentSkills(embedFS.FS, root, true)
	if err != nil {
		t.Fatal(err)
	}
	after, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if !before.ModTime().Equal(after.ModTime()) {
		t.Fatal("current skill was unnecessarily rewritten")
	}
	for _, result := range results {
		if result.Installed || result.Updated {
			t.Fatalf("unexpected idempotent skill result: %#v", result)
		}
	}
}
