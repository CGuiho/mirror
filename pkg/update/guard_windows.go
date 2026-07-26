//go:build windows

package update

import (
	"os"
	"syscall"
	"unsafe"
)

var (
	lockFileExProc   = syscall.NewLazyDLL("kernel32.dll").NewProc("LockFileEx")
	unlockFileExProc = syscall.NewLazyDLL("kernel32.dll").NewProc("UnlockFileEx")
)

func tryLeaseGuard(path string) (func(), bool) {
	const exclusiveImmediate = 0x00000003
	file, err := os.OpenFile(path+".guard", os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, false
	}
	overlapped := &syscall.Overlapped{}
	result, _, _ := lockFileExProc.Call(
		file.Fd(), exclusiveImmediate, 0, 0xffffffff, 0xffffffff,
		uintptr(unsafe.Pointer(overlapped)),
	)
	if result == 0 {
		file.Close()
		return nil, false
	}
	return func() {
		_, _, _ = unlockFileExProc.Call(
			file.Fd(), 0, 0xffffffff, 0xffffffff,
			uintptr(unsafe.Pointer(overlapped)),
		)
		_ = file.Close()
	}, true
}
