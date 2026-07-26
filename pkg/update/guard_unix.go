//go:build !windows

package update

import (
	"os"
	"syscall"
)

func tryLeaseGuard(path string) (func(), bool) {
	file, err := os.OpenFile(path+".guard", os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, false
	}
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		file.Close()
		return nil, false
	}
	return func() {
		_ = syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
		_ = file.Close()
	}, true
}
