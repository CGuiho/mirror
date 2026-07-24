package maintenance

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
)

// FindAgentsMD searches for AGENTS.md starting from startDir up through parent directories.
// Returns the absolute path to AGENTS.md if found, or filepath.Join(startDir, "AGENTS.md") if not found.
func FindAgentsMD(startDir string) (string, error) {
	absDir, err := filepath.Abs(startDir)
	if err != nil {
		return "", err
	}

	curr := absDir
	for {
		candidate := filepath.Join(curr, "AGENTS.md")
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}

		parent := filepath.Dir(curr)
		if parent == curr {
			break
		}
		curr = parent
	}

	return filepath.Join(absDir, "AGENTS.md"), nil
}

// ReadAGENTSFile reads the contents of the file at path. Returns empty string if file does not exist.
func ReadAGENTSFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

// WriteAGENTSFile writes content to path, creating directories as needed.
func WriteAGENTSFile(path string, content string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0644)
}

// EnsureSkillFile checks if a file at targetPath exists with matching content.
// If missing or different, it creates parent directories and writes content. Returns true if updated.
func EnsureSkillFile(targetPath string, content []byte) (bool, error) {
	existing, err := os.ReadFile(targetPath)
	if err == nil && bytes.Equal(existing, content) {
		return false, nil
	}

	dir := filepath.Dir(targetPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return false, err
	}

	if err := os.WriteFile(targetPath, content, 0644); err != nil {
		return false, err
	}

	return true, nil
}
