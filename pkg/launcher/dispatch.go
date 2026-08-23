package launcher

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
)

type Streams struct {
	In  io.Reader
	Out io.Writer
	Err io.Writer
}

func Dispatch(args []string, version string, streams Streams) (bool, int, error) {
	paths, err := UserPaths()
	if err != nil {
		return false, 0, err
	}
	executable, err := os.Executable()
	if err != nil {
		return false, 0, fmt.Errorf("resolve launcher executable: %w", err)
	}
	if !IsCanonicalLauncher(executable, paths) {
		return false, 0, nil
	}
	if err := EnsureBootstrapped(paths, executable, version); err != nil {
		return true, 1, err
	}
	if isVersionOnly(args) && usesLegacyDecoratedVersionProbe(executable) {
		if _, err := fmt.Fprintf(streams.Out, "mirror v%s\n", normalizeVersion(version)); err != nil {
			return true, 1, err
		}
		return true, 0, nil
	}
	removeLegacyReplacementArtifacts(paths.Launcher)
	state, err := ReadState(paths)
	if err != nil {
		return true, 1, err
	}
	code, startErr := runEntry(paths, state.Active, args, streams)
	if startErr == nil {
		return true, code, nil
	}
	if state.Previous == nil {
		return true, 1, fmt.Errorf("start active Mirror payload: %w", startErr)
	}
	fallbackCode, fallbackErr := runEntry(paths, *state.Previous, args, streams)
	if fallbackErr != nil {
		return true, 1, fmt.Errorf("start active Mirror payload: %v; start previous payload: %w", startErr, fallbackErr)
	}
	fallback := State{Schema: StateSchema, Active: *state.Previous, Previous: &state.Active}
	if err := WriteState(paths, fallback); err != nil {
		return true, 1, fmt.Errorf("activate previous Mirror payload after fallback: %w", err)
	}
	return true, fallbackCode, nil
}

func EnsureBootstrapped(paths Paths, executable, version string) error {
	if _, err := ReadState(paths); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read existing launcher state: %w", err)
	}
	checksum, err := FileSHA256(executable)
	if err != nil {
		return fmt.Errorf("hash launcher bootstrap payload: %w", err)
	}
	entry, _, err := InstallPayload(paths, executable, normalizeVersion(version), checksum)
	if err != nil {
		return fmt.Errorf("install launcher bootstrap payload: %w", err)
	}
	if _, err := Activate(paths, entry); err != nil {
		return fmt.Errorf("activate launcher bootstrap payload: %w", err)
	}
	return nil
}

func runEntry(paths Paths, entry Entry, args []string, streams Streams) (int, error) {
	payload, err := VerifyEntry(paths, entry)
	if err != nil {
		return 1, err
	}
	command := exec.Command(payload, args...)
	command.Stdin = streams.In
	command.Stdout = streams.Out
	command.Stderr = streams.Err
	command.Env = os.Environ()
	if err := command.Start(); err != nil {
		return 1, err
	}
	if err := command.Wait(); err != nil {
		var exitError *exec.ExitError
		if errors.As(err, &exitError) {
			return exitError.ExitCode(), nil
		}
		return 1, err
	}
	return 0, nil
}

func removeLegacyReplacementArtifacts(executable string) {
	for _, suffix := range []string{".old", ".outdated", ".failed"} {
		_ = os.Remove(executable + suffix)
	}
}

func isVersionOnly(args []string) bool {
	return len(args) == 1 && (args[0] == "--version" || args[0] == "-v")
}

func normalizeVersion(version string) string {
	if len(version) > 0 && version[0] == 'v' {
		return version[1:]
	}
	return version
}
