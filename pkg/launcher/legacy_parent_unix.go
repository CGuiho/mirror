//go:build !windows

package launcher

func usesLegacyDecoratedVersionProbe(string) bool {
	return false
}
