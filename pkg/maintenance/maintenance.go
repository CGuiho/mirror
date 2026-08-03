package maintenance

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

const (
	SkillName        = "guiho-s-mirror"
	BlockBeginMarker = "<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->"
	BlockEndMarker   = "<!-- END MIRROR -->"
)

type SkillResult struct {
	Tool      string `json:"tool"`
	Path      string `json:"path"`
	Installed bool   `json:"installed"`
	Updated   bool   `json:"updated"`
}

type skillStage struct {
	tool, destination, staged, backup string
	existed, installed, backedUp      bool
	unchanged                         bool
	previous                          []byte
}

func embeddedSkill(embeddedFS embed.FS) ([]byte, error) {
	content, err := fs.ReadFile(embeddedFS, "skills/guiho-s-mirror/SKILL.md")
	if err != nil {
		return nil, fmt.Errorf("read embedded Mirror skill: %w", err)
	}
	return content, nil
}

func skillRoot(targetDir string, local bool) (string, error) {
	if local {
		return filepath.Abs(targetDir)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve user home: %w", err)
	}
	return home, nil
}

// ReconcileAgentSkills atomically updates both targets below targetDir. The
// explicit CLI path uses InstallAgentSkills to choose global or local scope.
func ReconcileAgentSkills(embeddedFS embed.FS, targetDir string) error {
	_, err := InstallAgentSkills(embeddedFS, targetDir, true)
	return err
}

func InstallAgentSkills(embeddedFS embed.FS, targetDir string, local bool) ([]SkillResult, error) {
	content, err := embeddedSkill(embeddedFS)
	if err != nil {
		return nil, err
	}
	root, err := skillRoot(targetDir, local)
	if err != nil {
		return nil, err
	}
	stages := make([]skillStage, 0, 2)
	for _, tool := range []string{"agents", "claude"} {
		destination := filepath.Join(root, "."+tool, "skills", SkillName)
		stage, err := prepareSkillStage(tool, destination, content)
		if err != nil {
			cleanupStages(stages)
			return nil, err
		}
		stages = append(stages, stage)
	}
	for index := range stages {
		if err := commitStage(&stages[index]); err != nil {
			rollbackErr := rollbackStages(stages)
			if rollbackErr != nil {
				return nil, fmt.Errorf("%w; skill transaction rollback failed: %v", err, rollbackErr)
			}
			return nil, err
		}
	}
	results := make([]SkillResult, 0, len(stages))
	for _, stage := range stages {
		results = append(results, SkillResult{
			Tool: stage.tool, Path: stage.destination,
			Installed: !stage.existed,
			Updated:   stage.existed && string(stage.previous) != string(content),
		})
	}
	cleanupStages(stages)
	return results, nil
}

func prepareSkillStage(tool, destination string, content []byte) (skillStage, error) {
	stage := skillStage{tool: tool, destination: destination}
	parent := filepath.Dir(destination)
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return stage, fmt.Errorf("create skill parent: %w", err)
	}
	temp, err := os.MkdirTemp(parent, ".mirror-skill-new-*")
	if err != nil {
		return stage, fmt.Errorf("create staged skill: %w", err)
	}
	stage.staged = temp
	if err := os.WriteFile(filepath.Join(temp, "SKILL.md"), content, 0o644); err != nil {
		os.RemoveAll(temp)
		return stage, fmt.Errorf("write staged skill: %w", err)
	}
	if info, statErr := os.Stat(destination); statErr == nil {
		if !info.IsDir() {
			os.RemoveAll(temp)
			return stage, fmt.Errorf("installed skill path is not a directory: %s", destination)
		}
		stage.existed = true
	} else if !errors.Is(statErr, os.ErrNotExist) {
		os.RemoveAll(temp)
		return stage, fmt.Errorf("inspect installed skill: %w", statErr)
	}
	stage.previous, err = os.ReadFile(filepath.Join(destination, "SKILL.md"))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		os.RemoveAll(temp)
		return stage, fmt.Errorf("read installed skill: %w", err)
	}
	if stage.existed && bytes.Equal(stage.previous, content) {
		_ = os.RemoveAll(stage.staged)
		stage.staged = ""
		stage.unchanged = true
		return stage, nil
	}
	stage.backup, err = reserveSibling(parent, ".mirror-skill-backup-*")
	if err != nil {
		os.RemoveAll(temp)
		return stage, err
	}
	return stage, nil
}

func reserveSibling(parent, pattern string) (string, error) {
	path, err := os.MkdirTemp(parent, pattern)
	if err != nil {
		return "", fmt.Errorf("reserve skill transaction path: %w", err)
	}
	if err := os.Remove(path); err != nil {
		return "", fmt.Errorf("release skill transaction path: %w", err)
	}
	return path, nil
}

func commitStage(stage *skillStage) error {
	if stage.unchanged {
		return nil
	}
	if stage.existed {
		if err := os.Rename(stage.destination, stage.backup); err != nil {
			return fmt.Errorf("backup installed skill: %w", err)
		}
		stage.backedUp = true
	}
	if err := os.Rename(stage.staged, stage.destination); err != nil {
		return fmt.Errorf("install staged skill: %w", err)
	}
	stage.staged = ""
	stage.installed = true
	return nil
}

func rollbackStages(stages []skillStage) error {
	var failures []string
	for index := len(stages) - 1; index >= 0; index-- {
		stage := &stages[index]
		if stage.installed {
			if err := os.RemoveAll(stage.destination); err != nil {
				failures = append(failures, err.Error())
			}
		}
		if stage.backedUp {
			if err := os.Rename(stage.backup, stage.destination); err != nil {
				failures = append(failures, err.Error())
			} else {
				stage.backup = ""
			}
		}
	}
	cleanupStages(stages)
	if len(failures) > 0 {
		return errors.New(strings.Join(failures, "; "))
	}
	return nil
}

func cleanupStages(stages []skillStage) {
	for _, stage := range stages {
		if stage.staged != "" {
			_ = os.RemoveAll(stage.staged)
		}
		if stage.backup != "" {
			_ = os.RemoveAll(stage.backup)
		}
	}
}

func UninstallAgentSkills(targetDir string, local bool) ([]string, error) {
	root, err := skillRoot(targetDir, local)
	if err != nil {
		return nil, err
	}
	type removal struct {
		path, backup string
		moved        bool
	}
	var stages []removal
	for _, tool := range []string{"agents", "claude"} {
		path := filepath.Join(root, "."+tool, "skills", SkillName)
		if _, err := os.Stat(path); err == nil {
			backup, err := reserveSibling(filepath.Dir(path), ".mirror-skill-remove-*")
			if err != nil {
				return nil, err
			}
			stages = append(stages, removal{path: path, backup: backup})
		} else if !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("inspect installed skill: %w", err)
		}
	}
	for index := range stages {
		if err := os.Rename(stages[index].path, stages[index].backup); err != nil {
			var rollbackFailures []string
			for prior := index - 1; prior >= 0; prior-- {
				if stages[prior].moved {
					if rollbackErr := os.Rename(stages[prior].backup, stages[prior].path); rollbackErr != nil {
						rollbackFailures = append(rollbackFailures, rollbackErr.Error())
					}
				}
			}
			if len(rollbackFailures) > 0 {
				return nil, fmt.Errorf("stage skill removal: %w; rollback failed: %s", err, strings.Join(rollbackFailures, "; "))
			}
			return nil, fmt.Errorf("stage skill removal: %w", err)
		}
		stages[index].moved = true
	}
	removed := make([]string, 0, len(stages))
	for _, stage := range stages {
		removed = append(removed, stage.path)
		if err := os.RemoveAll(stage.backup); err != nil {
			return removed, fmt.Errorf("finalize skill removal: %w", err)
		}
	}
	return removed, nil
}

func UpdateAGENTSBlock(agentsPath, blockContent string) error {
	existing, err := ReadAGENTSFile(agentsPath)
	if err != nil {
		return err
	}
	if err := validateManagedBlock(existing); err != nil {
		return fmt.Errorf("validate managed instruction block in %s: %w", agentsPath, err)
	}
	return WriteAGENTSFile(agentsPath, reconcileBlock(existing, blockContent, false))
}

func RemoveAGENTSBlock(agentsPath string) error {
	existing, err := ReadAGENTSFile(agentsPath)
	if err != nil {
		return err
	}
	return WriteAGENTSFile(agentsPath, reconcileBlock(existing, "", true))
}

type InstructionResult struct {
	Path    string `json:"path"`
	Changed bool   `json:"changed"`
}

func ApplyInstructions(embeddedFS embed.FS, targetDir string) ([]InstructionResult, error) {
	body, err := EmbeddedInstructionBody(embeddedFS)
	if err != nil {
		return nil, err
	}
	return mutateInstructions(targetDir, body, false)
}

func EmbeddedInstructionBody(embeddedFS embed.FS) (string, error) {
	content, err := fs.ReadFile(embeddedFS, "prompts/guiho-i-mirror.md")
	if err != nil {
		return "", fmt.Errorf("read embedded Mirror instruction: %w", err)
	}
	body, err := instructionBody(string(content))
	if err != nil {
		return "", fmt.Errorf("render embedded Mirror instruction: %w", err)
	}
	return body, nil
}

func RemoveInstructions(targetDir string) ([]InstructionResult, error) {
	return mutateInstructions(targetDir, "", true)
}

func mutateInstructions(targetDir, block string, remove bool) ([]InstructionResult, error) {
	root, err := filepath.Abs(targetDir)
	if err != nil {
		return nil, err
	}
	candidates := []string{filepath.Join(root, "AGENTS.md"), filepath.Join(root, "CLAUDE.md")}
	var targets []string
	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			targets = append(targets, path)
		} else if !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("inspect instruction file: %w", err)
		}
	}
	if len(targets) == 0 && !remove {
		targets = append(targets, candidates[0])
	}
	type stagedInstruction struct {
		path, current, next string
		existed             bool
	}
	stages := make([]stagedInstruction, 0, len(targets))
	for _, path := range targets {
		data, err := os.ReadFile(path)
		existed := err == nil
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("read instruction file: %w", err)
		}
		current := string(data)
		if err := validateManagedBlock(current); err != nil {
			return nil, fmt.Errorf("validate managed instruction block in %s: %w", path, err)
		}
		next := reconcileBlock(current, block, remove)
		stages = append(stages, stagedInstruction{path: path, current: current, next: next, existed: existed})
	}
	var committed []stagedInstruction
	for _, stage := range stages {
		if stage.current == stage.next {
			continue
		}
		if err := WriteAGENTSFile(stage.path, stage.next); err != nil {
			for index := len(committed) - 1; index >= 0; index-- {
				previous := committed[index]
				if previous.existed {
					_ = WriteAGENTSFile(previous.path, previous.current)
				} else {
					_ = os.Remove(previous.path)
				}
			}
			return nil, fmt.Errorf("commit instruction transaction: %w", err)
		}
		committed = append(committed, stage)
	}
	results := make([]InstructionResult, 0, len(stages))
	for _, stage := range stages {
		results = append(results, InstructionResult{Path: stage.path, Changed: stage.current != stage.next})
	}
	return results, nil
}

func validateManagedBlock(content string) error {
	beginCount := strings.Count(content, BlockBeginMarker)
	endCount := strings.Count(content, BlockEndMarker)
	if beginCount != endCount {
		return fmt.Errorf("malformed Mirror markers: found %d begin and %d end markers", beginCount, endCount)
	}
	cursor := 0
	for cursor < len(content) {
		beginRelative := strings.Index(content[cursor:], BlockBeginMarker)
		endRelative := strings.Index(content[cursor:], BlockEndMarker)
		if beginRelative < 0 && endRelative < 0 {
			return nil
		}
		if beginRelative < 0 || endRelative < 0 || endRelative < beginRelative {
			return errors.New("malformed Mirror marker ordering")
		}
		end := cursor + endRelative + len(BlockEndMarker)
		if strings.Contains(content[cursor+beginRelative+len(BlockBeginMarker):cursor+endRelative], BlockBeginMarker) {
			return errors.New("nested Mirror begin markers are not allowed")
		}
		cursor = end
	}
	return nil
}

func instructionBody(content string) (string, error) {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	if !strings.HasPrefix(normalized, "---\n") {
		return "", errors.New("Mirror instruction frontmatter is missing")
	}
	frontmatterEnd := strings.Index(normalized[4:], "\n---\n")
	if frontmatterEnd < 0 {
		return "", errors.New("Mirror instruction frontmatter is not closed")
	}
	body := strings.TrimSpace(normalized[4+frontmatterEnd+5:])
	if body == "" {
		return "", errors.New("Mirror instruction body is empty")
	}
	return body, nil
}

func reconcileBlock(content, blockContent string, remove bool) string {
	newline := "\n"
	if strings.Contains(content, "\r\n") {
		newline = "\r\n"
	}
	block := BlockBeginMarker + newline +
		strings.ReplaceAll(strings.TrimSpace(blockContent), "\n", newline) + newline +
		BlockEndMarker
	var output strings.Builder
	cursor := 0
	inserted := false
	malformed := false
	for {
		relative := strings.Index(content[cursor:], BlockBeginMarker)
		if relative < 0 {
			break
		}
		start := cursor + relative
		output.WriteString(content[cursor:start])
		endRelative := strings.Index(content[start:], BlockEndMarker)
		if endRelative < 0 {
			output.WriteString(content[start:])
			cursor = len(content)
			malformed = true
			break
		}
		end := start + endRelative + len(BlockEndMarker)
		if !remove && !inserted {
			output.WriteString(block)
			inserted = true
		}
		cursor = end
	}
	output.WriteString(content[cursor:])
	result := output.String()
	if !remove && !inserted && !malformed {
		if result != "" && !strings.HasSuffix(result, newline) {
			result += newline
		}
		if result != "" && !strings.HasSuffix(result, newline+newline) {
			result += newline
		}
		result += block + newline
	}
	return result
}

func RunMaintenanceNonBlocking(embeddedFS embed.FS, targetDir, blockContent string) {
	go func() {
		_ = ReconcileAgentSkills(embeddedFS, targetDir)
		if blockContent != "" {
			if path, err := FindAgentsMD(targetDir); err == nil {
				_ = UpdateAGENTSBlock(path, blockContent)
			}
		}
	}()
}
