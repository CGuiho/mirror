//go:build windows

package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func replaceExecutable(executable, candidate, backup, targetVersion, checksum, lockPath, lockToken string, _ VerifyFunc) (bool, error) {
	helperFile, err := os.CreateTemp(filepath.Dir(executable), ".mirror-upgrade-helper-*.exe")
	if err != nil {
		return false, fmt.Errorf("create Windows upgrade helper: %w", err)
	}
	helper := helperFile.Name()
	source, err := os.Open(executable)
	if err != nil {
		helperFile.Close()
		os.Remove(helper)
		return false, fmt.Errorf("open current executable for helper: %w", err)
	}
	if _, err := io.Copy(helperFile, source); err != nil {
		source.Close()
		helperFile.Close()
		os.Remove(helper)
		return false, fmt.Errorf("copy Windows upgrade helper: %w", err)
	}
	source.Close()
	if err := helperFile.Close(); err != nil {
		os.Remove(helper)
		return false, fmt.Errorf("close Windows upgrade helper: %w", err)
	}
	command := exec.Command(
		helper, "upgrade", "__replace-windows",
		"--pid", strconv.Itoa(os.Getpid()),
		"--executable", executable,
		"--candidate", candidate,
		"--backup", backup,
		"--target-version", targetVersion,
		"--checksum", checksum,
		"--lock", lockPath,
		"--lock-token", lockToken,
		"--helper", helper,
	)
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	command.Stdin, command.Stdout, command.Stderr = nil, nil, nil
	if err := command.Start(); err != nil {
		os.Remove(helper)
		return false, fmt.Errorf("start Windows upgrade helper: %w", err)
	}
	if err := command.Process.Release(); err != nil {
		return false, fmt.Errorf("release Windows upgrade helper: %w", err)
	}
	return true, nil
}

func CompleteWindowsReplacement(executable, candidate, backup, targetVersion, checksum, helper, lockPath, lockToken string, parentPID int) (returnErr error) {
	completion := Completion{
		TargetVersion: targetVersion,
		Outcome:       "failed",
		Verification:  "not run",
		Rollback:      "not required",
		Recovery:      fmt.Sprintf("restore %q to %q", backup, executable),
	}
	defer func() {
		if returnErr != nil {
			completion.Failure = returnErr.Error()
		}
		_ = WriteCompletion(completion)
		releaseOwnedLock(lockPath, lockToken)
		scheduleDelete(helper)
	}()
	if err := waitForProcessExit(uint32(parentPID), 120*time.Second); err != nil {
		return err
	}
	if calculated, err := fileSHA256(candidate); err != nil {
		return err
	} else if calculated != checksum {
		return fmt.Errorf("staged Windows candidate checksum changed: expected %s, got %s", checksum, calculated)
	}
	if err := os.Rename(executable, backup); err != nil {
		return fmt.Errorf("backup current Windows executable: %w", err)
	}
	if err := os.Rename(candidate, executable); err != nil {
		if rollbackErr := os.Rename(backup, executable); rollbackErr != nil {
			completion.Rollback = "failed"
			return fmt.Errorf("activate Windows update: %w; rollback also failed: %v", err, rollbackErr)
		}
		completion.Rollback = "succeeded"
		return fmt.Errorf("activate Windows update: %w", err)
	}
	if err := VerifyExecutable(executable, targetVersion); err != nil {
		completion.Verification = "failed"
		failed := executable + ".failed"
		_ = os.Remove(failed)
		if moveErr := os.Rename(executable, failed); moveErr != nil {
			completion.Rollback = "failed"
			return fmt.Errorf("%w; stage failed replacement: %v", err, moveErr)
		}
		if rollbackErr := os.Rename(backup, executable); rollbackErr != nil {
			completion.Rollback = "failed"
			return fmt.Errorf("%w; rollback also failed: %v", err, rollbackErr)
		}
		_ = os.Remove(failed)
		completion.Rollback = "succeeded"
		return err
	}
	completion.Outcome = "succeeded"
	completion.Verification = "succeeded"
	completion.Rollback = "not required"
	completion.Recovery = ""
	return nil
}

func releaseOwnedLock(path, token string) {
	content, err := os.ReadFile(path)
	if err == nil && strings.TrimSpace(string(content)) == token {
		_ = os.Remove(path)
	}
}

func fileSHA256(path string) (string, error) {
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

func scheduleDelete(path string) {
	command := exec.Command("cmd.exe", "/d", "/c", "ping 127.0.0.1 -n 2 >nul & del /f /q \""+path+"\"")
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	_ = command.Start()
}

func waitForProcessExit(pid uint32, timeout time.Duration) error {
	const (
		synchronizeAccess = 0x00100000
		waitObject0       = 0x00000000
		waitTimeout       = 0x00000102
	)
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	openProcess := kernel32.NewProc("OpenProcess")
	wait := kernel32.NewProc("WaitForSingleObject")
	closeHandle := kernel32.NewProc("CloseHandle")
	handle, _, callErr := openProcess.Call(synchronizeAccess, 0, uintptr(pid))
	if handle == 0 {
		if errno, ok := callErr.(syscall.Errno); ok && errno == syscall.Errno(87) {
			return nil
		}
		return fmt.Errorf("open running Mirror process: %w", callErr)
	}
	defer closeHandle.Call(handle)
	result, _, waitErr := wait.Call(handle, uintptr(timeout.Milliseconds()))
	switch result {
	case waitObject0:
		return nil
	case waitTimeout:
		return errors.New("timed out waiting for running Mirror process to exit")
	default:
		return fmt.Errorf("wait for running Mirror process: %w", waitErr)
	}
}
