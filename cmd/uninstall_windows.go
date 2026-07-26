//go:build windows

package cmd

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
	"unsafe"
)

func removeExecutable(path string) (bool, error) {
	source, err := os.Open(path)
	if err != nil {
		return false, fmt.Errorf("open Mirror executable for uninstall helper: %w", err)
	}
	defer source.Close()
	helperFile, err := os.CreateTemp(filepath.Dir(path), ".mirror-uninstall-helper-*.exe")
	if err != nil {
		return false, fmt.Errorf("create Mirror uninstall helper: %w", err)
	}
	helper := helperFile.Name()
	if _, err := io.Copy(helperFile, source); err != nil {
		helperFile.Close()
		os.Remove(helper)
		return false, fmt.Errorf("copy Mirror uninstall helper: %w", err)
	}
	if err := helperFile.Close(); err != nil {
		os.Remove(helper)
		return false, fmt.Errorf("close Mirror uninstall helper: %w", err)
	}
	command := exec.Command(
		helper, "uninstall", "__remove-windows",
		"--pid", strconv.Itoa(os.Getpid()),
		"--executable", path,
		"--helper", helper,
	)
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	command.Stdin, command.Stdout, command.Stderr = nil, nil, nil
	if err := command.Start(); err != nil {
		os.Remove(helper)
		return false, fmt.Errorf("start Mirror uninstall helper: %w", err)
	}
	if err := command.Process.Release(); err != nil {
		return false, fmt.Errorf("release Mirror uninstall helper: %w", err)
	}
	return true, nil
}

func completeWindowsUninstall(executable, helper string, parentPID int) error {
	if err := waitForUninstallParent(uint32(parentPID), 2*time.Minute); err != nil {
		return err
	}
	if err := os.Remove(executable); err != nil {
		return fmt.Errorf("remove Mirror executable: %w", err)
	}
	// A running helper cannot delete itself. Ask Windows to remove it at the
	// next reboot without interpolating paths through a command shell.
	if err := deleteAtReboot(helper); err != nil {
		return fmt.Errorf("schedule uninstall helper cleanup: %w", err)
	}
	return nil
}

func waitForUninstallParent(pid uint32, timeout time.Duration) error {
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
		return fmt.Errorf("timed out waiting for running Mirror process to exit")
	default:
		return fmt.Errorf("wait for running Mirror process: %w", waitErr)
	}
}

func deleteAtReboot(path string) error {
	const moveFileDelayUntilReboot = 0x00000004
	pointer, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return err
	}
	moveFileEx := syscall.NewLazyDLL("kernel32.dll").NewProc("MoveFileExW")
	result, _, callErr := moveFileEx.Call(uintptr(unsafe.Pointer(pointer)), 0, moveFileDelayUntilReboot)
	if result == 0 {
		return callErr
	}
	return nil
}
