//go:build !windows

package hooks

import "os"

func replaceFile(source, destination string) error {
	return os.Rename(source, destination)
}
