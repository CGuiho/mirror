package updater

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Completion struct {
	TargetVersion string `json:"targetVersion"`
	Outcome       string `json:"outcome"`
	Verification  string `json:"verification"`
	Rollback      string `json:"rollback"`
	Recovery      string `json:"recovery,omitempty"`
	Failure       string `json:"failure,omitempty"`
	CompletedAt   string `json:"completedAt"`
}

func JournalPath() (string, error) {
	if override := os.Getenv("MIRROR_CACHE_DIR"); override != "" {
		return filepath.Join(override, "upgrade-result.json"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".guiho", "mirror", "upgrade-result.json"), nil
}

func WriteCompletion(completion Completion) error {
	path, err := JournalPath()
	if err != nil {
		return err
	}
	completion.CompletedAt = time.Now().UTC().Format(time.RFC3339)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".mirror-upgrade-result-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if err := json.NewEncoder(temp).Encode(completion); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempPath, path)
}

func ConsumeCompletion() (*Completion, error) {
	path, err := JournalPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()
	var completion Completion
	if err := decoder.Decode(&completion); err != nil {
		return nil, fmt.Errorf("decode upgrade completion: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, errors.New("decode upgrade completion: expected exactly one JSON document")
	}
	if completion.TargetVersion == "" || completion.Outcome == "" || completion.CompletedAt == "" {
		return nil, errors.New("decode upgrade completion: required fields are missing")
	}
	if err := os.Remove(path); err != nil {
		return nil, fmt.Errorf("consume upgrade completion: %w", err)
	}
	return &completion, nil
}
