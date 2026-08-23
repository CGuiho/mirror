//go:build windows

package launcher

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

func usesLegacyDecoratedVersionProbe(executable string) bool {
	if !isUpgradeHelperParent() {
		return false
	}
	legacy := executable + ".old"
	if _, err := os.Stat(legacy); err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, legacy, "--version")
	command.Env = append(os.Environ(), "MIRROR_DISABLE_UPDATE_CHECK=1")
	output, err := command.CombinedOutput()
	return err == nil && strings.HasPrefix(strings.TrimSpace(string(output)), "mirror v")
}

func isUpgradeHelperParent() bool {
	parentPID := os.Getppid()
	if parentPID <= 0 {
		return false
	}
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	openProcess := kernel32.NewProc("OpenProcess")
	queryImage := kernel32.NewProc("QueryFullProcessImageNameW")
	closeHandle := kernel32.NewProc("CloseHandle")
	const processQueryLimitedInformation = 0x1000
	handle, _, _ := openProcess.Call(processQueryLimitedInformation, 0, uintptr(parentPID))
	if handle == 0 {
		return false
	}
	defer closeHandle.Call(handle)
	buffer := make([]uint16, 32768)
	size := uint32(len(buffer))
	result, _, _ := queryImage.Call(
		handle,
		0,
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if result == 0 || size == 0 || int(size) > len(buffer) {
		return false
	}
	name := strings.ToLower(filepath.Base(syscall.UTF16ToString(buffer[:size])))
	return strings.HasPrefix(name, ".mirror-upgrade-helper-") && strings.HasSuffix(name, ".exe")
}
