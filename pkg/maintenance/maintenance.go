package maintenance

import (
	"embed"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
)

const (
	BlockBeginMarker = "<!-- GUIHO AGENT BLOCK BEGIN -->"
	BlockEndMarker   = "<!-- GUIHO AGENT BLOCK END -->"
)

// ReconcileAgentSkills extracts embedded skill and prompt files into target directories.
// It syncs skills to .agents/skills/ and .claude/skills/ under targetDir.
func ReconcileAgentSkills(embeddedFS embed.FS, targetDir string) error {
	err := fs.WalkDir(embeddedFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}

		data, readErr := embeddedFS.ReadFile(path)
		if readErr != nil {
			return readErr
		}

		filename := filepath.Base(path)

		// Skill files
		if strings.HasPrefix(path, "skills/") {
			skillName := strings.TrimSuffix(filename, ".SKILL.md")
			skillName = strings.TrimSuffix(skillName, ".md")

			// Target 1: .agents/skills/<skillName>/SKILL.md
			agentsTarget := filepath.Join(targetDir, ".agents", "skills", skillName, "SKILL.md")
			if _, err := EnsureSkillFile(agentsTarget, data); err != nil {
				return err
			}

			// Target 2: .claude/skills/<skillName>/SKILL.md
			claudeTarget := filepath.Join(targetDir, ".claude", "skills", skillName, "SKILL.md")
			if _, err := EnsureSkillFile(claudeTarget, data); err != nil {
				return err
			}
		}

		// Prompt files
		if strings.HasPrefix(path, "prompts/") {
			promptTarget := filepath.Join(targetDir, ".agents", "prompts", filename)
			if _, err := EnsureSkillFile(promptTarget, data); err != nil {
				return err
			}
		}

		return nil
	})

	return err
}

// UpdateAGENTSBlock idempotently updates the managed block within an AGENTS.md file.
func UpdateAGENTSBlock(agentsPath string, blockContent string) error {
	existingContent, err := ReadAGENTSFile(agentsPath)
	if err != nil {
		return err
	}

	formattedBlock := fmt.Sprintf("%s\n%s\n%s", BlockBeginMarker, strings.TrimSpace(blockContent), BlockEndMarker)

	beginIdx := strings.Index(existingContent, BlockBeginMarker)
	endIdx := strings.Index(existingContent, BlockEndMarker)

	var newContent string
	if beginIdx != -1 && endIdx != -1 && endIdx >= beginIdx {
		// Replace existing block
		before := existingContent[:beginIdx]
		after := existingContent[endIdx+len(BlockEndMarker):]
		newContent = strings.TrimRight(before, "\r\n") + "\n" + formattedBlock + "\n" + strings.TrimLeft(after, "\r\n")
	} else {
		// Append block
		if strings.TrimSpace(existingContent) == "" {
			newContent = formattedBlock + "\n"
		} else {
			newContent = strings.TrimRight(existingContent, "\r\n") + "\n\n" + formattedBlock + "\n"
		}
	}

	return WriteAGENTSFile(agentsPath, newContent)
}

// RunMaintenanceNonBlocking executes agent skill reconciliation and AGENTS.md block update non-blocking.
func RunMaintenanceNonBlocking(embeddedFS embed.FS, targetDir string, blockContent string) {
	go func() {
		_ = ReconcileAgentSkills(embeddedFS, targetDir)
		if blockContent != "" {
			agentsPath, err := FindAgentsMD(targetDir)
			if err == nil {
				_ = UpdateAGENTSBlock(agentsPath, blockContent)
			}
		}
	}()
}
