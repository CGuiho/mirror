package launcher

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

const StateSchema = 1

type Entry struct {
	Version      string `json:"version"`
	RelativePath string `json:"relativePath"`
	SHA256       string `json:"sha256"`
}

type State struct {
	Schema   int    `json:"schema"`
	Active   Entry  `json:"active"`
	Previous *Entry `json:"previous,omitempty"`
}

type Paths struct {
	UserHome     string
	SharedBin    string
	CLIHome      string
	Versions     string
	SharedTemp   string
	Launcher     string
	CurrentState string
	UpgradeLock  string
}

func ResolvePaths(userHome string) (Paths, error) {
	if strings.TrimSpace(userHome) == "" {
		return Paths{}, errors.New("user home is required")
	}
	absolute, err := filepath.Abs(userHome)
	if err != nil {
		return Paths{}, fmt.Errorf("resolve user home: %w", err)
	}
	guihoHome := filepath.Join(absolute, ".guiho")
	name := "mirror"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	cliHome := filepath.Join(guihoHome, "mirror")
	return Paths{
		UserHome:     absolute,
		SharedBin:    filepath.Join(guihoHome, "bin"),
		CLIHome:      cliHome,
		Versions:     filepath.Join(cliHome, "versions"),
		SharedTemp:   filepath.Join(guihoHome, ".temp"),
		Launcher:     filepath.Join(guihoHome, "bin", name),
		CurrentState: filepath.Join(cliHome, "current.json"),
		UpgradeLock:  filepath.Join(cliHome, "upgrade.lock"),
	}, nil
}

func UserPaths() (Paths, error) {
	home := os.Getenv("MIRROR_HOME_DIR")
	if home == "" {
		var err error
		home, err = os.UserHomeDir()
		if err != nil {
			return Paths{}, fmt.Errorf("resolve user home: %w", err)
		}
	}
	paths, err := ResolvePaths(home)
	if err != nil {
		return Paths{}, err
	}
	if override := strings.TrimSpace(os.Getenv("MIRROR_INSTALL_DIR")); override != "" {
		absolute, err := filepath.Abs(override)
		if err != nil {
			return Paths{}, fmt.Errorf("resolve Mirror install directory: %w", err)
		}
		name := "mirror"
		if runtime.GOOS == "windows" {
			name += ".exe"
		}
		paths.SharedBin = absolute
		paths.Launcher = filepath.Join(absolute, name)
	}
	return paths, nil
}

func IsCanonicalLauncher(executable string, paths Paths) bool {
	return samePath(executable, paths.Launcher)
}

func ReadState(paths Paths) (State, error) {
	file, err := os.Open(paths.CurrentState)
	if err != nil {
		return State{}, err
	}
	defer file.Close()
	decoder := json.NewDecoder(io.LimitReader(file, 64<<10))
	decoder.DisallowUnknownFields()
	var state State
	if err := decoder.Decode(&state); err != nil {
		return State{}, fmt.Errorf("decode current launcher state: %w", err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return State{}, errors.New("decode current launcher state: multiple JSON values")
		}
		return State{}, fmt.Errorf("decode current launcher state: %w", err)
	}
	if err := ValidateState(paths, state); err != nil {
		return State{}, err
	}
	return state, nil
}

func ValidateState(paths Paths, state State) error {
	if state.Schema != StateSchema {
		return fmt.Errorf("unsupported current launcher state schema %d", state.Schema)
	}
	if err := validateEntry(paths, state.Active); err != nil {
		return fmt.Errorf("validate active launcher payload: %w", err)
	}
	if state.Previous != nil {
		if err := validateEntry(paths, *state.Previous); err != nil {
			return fmt.Errorf("validate previous launcher payload: %w", err)
		}
	}
	return nil
}

func PayloadPath(paths Paths, entry Entry) (string, error) {
	if err := validateEntry(paths, entry); err != nil {
		return "", err
	}
	return filepath.Join(paths.CLIHome, filepath.FromSlash(entry.RelativePath)), nil
}

func EntryFor(version, checksum string) (Entry, error) {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	if version == "" || strings.ContainsAny(version, `/\\`) || version == "." || version == ".." {
		return Entry{}, fmt.Errorf("invalid payload version %q", version)
	}
	checksum = strings.ToLower(strings.TrimSpace(checksum))
	if len(checksum) != sha256.Size*2 {
		return Entry{}, errors.New("payload SHA-256 is required")
	}
	if _, err := hex.DecodeString(checksum); err != nil {
		return Entry{}, errors.New("payload SHA-256 is invalid")
	}
	name := "mirror"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return Entry{
		Version:      version,
		RelativePath: filepath.ToSlash(filepath.Join("versions", version, name)),
		SHA256:       checksum,
	}, nil
}

func InstallPayload(paths Paths, source, version, checksum string) (Entry, string, error) {
	entry, err := EntryFor(version, checksum)
	if err != nil {
		return Entry{}, "", err
	}
	destination, err := PayloadPath(paths, entry)
	if err != nil {
		return Entry{}, "", err
	}
	if observed, hashErr := FileSHA256(destination); hashErr == nil {
		if observed != entry.SHA256 {
			return Entry{}, "", fmt.Errorf("immutable payload already exists with different checksum: %s", destination)
		}
		return entry, destination, nil
	} else if !errors.Is(hashErr, os.ErrNotExist) {
		return Entry{}, "", fmt.Errorf("inspect immutable payload: %w", hashErr)
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		return Entry{}, "", fmt.Errorf("create immutable payload directory: %w", err)
	}
	stage, err := os.CreateTemp(filepath.Dir(destination), ".mirror-payload-*")
	if err != nil {
		return Entry{}, "", fmt.Errorf("create immutable payload stage: %w", err)
	}
	stagePath := stage.Name()
	removeStage := true
	defer func() {
		stage.Close()
		if removeStage {
			_ = os.Remove(stagePath)
		}
	}()
	sourceFile, err := os.Open(source)
	if err != nil {
		return Entry{}, "", fmt.Errorf("open payload source: %w", err)
	}
	_, copyErr := io.Copy(stage, sourceFile)
	closeSourceErr := sourceFile.Close()
	if copyErr != nil {
		return Entry{}, "", fmt.Errorf("copy immutable payload: %w", copyErr)
	}
	if closeSourceErr != nil {
		return Entry{}, "", fmt.Errorf("close payload source: %w", closeSourceErr)
	}
	if err := stage.Sync(); err != nil {
		return Entry{}, "", fmt.Errorf("sync immutable payload: %w", err)
	}
	if err := stage.Close(); err != nil {
		return Entry{}, "", fmt.Errorf("close immutable payload: %w", err)
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(stagePath, 0o755); err != nil {
			return Entry{}, "", fmt.Errorf("make immutable payload executable: %w", err)
		}
	}
	if observed, err := FileSHA256(stagePath); err != nil {
		return Entry{}, "", fmt.Errorf("hash immutable payload: %w", err)
	} else if observed != entry.SHA256 {
		return Entry{}, "", fmt.Errorf("immutable payload checksum mismatch: expected %s, got %s", entry.SHA256, observed)
	}
	if err := os.Rename(stagePath, destination); err != nil {
		return Entry{}, "", fmt.Errorf("activate immutable payload file: %w", err)
	}
	removeStage = false
	return entry, destination, nil
}

func Activate(paths Paths, entry Entry) (*State, error) {
	if err := validateEntry(paths, entry); err != nil {
		return nil, err
	}
	var previousState *State
	current, err := ReadState(paths)
	if err == nil {
		copy := current
		previousState = &copy
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	next := State{Schema: StateSchema, Active: entry}
	if previousState != nil {
		if previousState.Active.RelativePath != entry.RelativePath || previousState.Active.SHA256 != entry.SHA256 {
			old := previousState.Active
			next.Previous = &old
		} else {
			next.Previous = previousState.Previous
		}
	}
	if err := WriteState(paths, next); err != nil {
		return previousState, err
	}
	return previousState, nil
}

func Restore(paths Paths, previous *State) error {
	if previous == nil {
		if err := os.Remove(paths.CurrentState); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove new launcher state: %w", err)
		}
		return nil
	}
	return WriteState(paths, *previous)
}

func WriteState(paths Paths, state State) error {
	if err := ValidateState(paths, state); err != nil {
		return err
	}
	if err := os.MkdirAll(paths.CLIHome, 0o755); err != nil {
		return fmt.Errorf("create Mirror home: %w", err)
	}
	content, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("encode current launcher state: %w", err)
	}
	content = append(content, '\n')
	stage, err := os.CreateTemp(paths.CLIHome, ".current-*.json")
	if err != nil {
		return fmt.Errorf("create current launcher state: %w", err)
	}
	stagePath := stage.Name()
	defer os.Remove(stagePath)
	if err := stage.Chmod(0o600); err != nil {
		stage.Close()
		return fmt.Errorf("secure current launcher state: %w", err)
	}
	if _, err := stage.Write(content); err != nil {
		stage.Close()
		return fmt.Errorf("write current launcher state: %w", err)
	}
	if err := stage.Sync(); err != nil {
		stage.Close()
		return fmt.Errorf("sync current launcher state: %w", err)
	}
	if err := stage.Close(); err != nil {
		return fmt.Errorf("close current launcher state: %w", err)
	}
	if err := os.Rename(stagePath, paths.CurrentState); err != nil {
		return fmt.Errorf("activate current launcher state: %w", err)
	}
	return nil
}

func FileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func VerifyEntry(paths Paths, entry Entry) (string, error) {
	path, err := PayloadPath(paths, entry)
	if err != nil {
		return "", err
	}
	observed, err := FileSHA256(path)
	if err != nil {
		return "", fmt.Errorf("hash launcher payload: %w", err)
	}
	if observed != entry.SHA256 {
		return "", fmt.Errorf("launcher payload checksum mismatch: expected %s, got %s", entry.SHA256, observed)
	}
	return path, nil
}

func validateEntry(paths Paths, entry Entry) error {
	if entry.Version == "" {
		return errors.New("version is required")
	}
	if entry.RelativePath == "" {
		return errors.New("relative path is required")
	}
	if filepath.IsAbs(filepath.FromSlash(entry.RelativePath)) {
		return errors.New("absolute payload path is forbidden")
	}
	if len(entry.SHA256) != sha256.Size*2 {
		return errors.New("payload SHA-256 is invalid")
	}
	if _, err := hex.DecodeString(entry.SHA256); err != nil {
		return errors.New("payload SHA-256 is invalid")
	}
	candidate := filepath.Clean(filepath.Join(paths.CLIHome, filepath.FromSlash(entry.RelativePath)))
	relative, err := filepath.Rel(paths.Versions, candidate)
	if err != nil || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) || filepath.IsAbs(relative) {
		return errors.New("payload path escapes the versions directory")
	}
	return nil
}

func samePath(left, right string) bool {
	leftAbs, leftErr := filepath.Abs(left)
	rightAbs, rightErr := filepath.Abs(right)
	if leftErr != nil || rightErr != nil {
		return false
	}
	leftAbs = filepath.Clean(leftAbs)
	rightAbs = filepath.Clean(rightAbs)
	if runtime.GOOS == "windows" {
		return strings.EqualFold(leftAbs, rightAbs)
	}
	return leftAbs == rightAbs
}
