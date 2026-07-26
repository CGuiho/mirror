package release

import (
	"fmt"
	"sort"
	"strings"
)

type Target struct {
	Name   string
	GOOS   string
	GOARCH string
	Tuning string
}

var Targets = []Target{
	{Name: "mirror-linux-amd64", GOOS: "linux", GOARCH: "amd64", Tuning: "GOAMD64=v1"},
	{Name: "mirror-linux-arm64", GOOS: "linux", GOARCH: "arm64", Tuning: "GOARM64=v8.0"},
	{Name: "mirror-linux-armv7", GOOS: "linux", GOARCH: "arm", Tuning: "GOARM=7"},
	{Name: "mirror-linux-armv6", GOOS: "linux", GOARCH: "arm", Tuning: "GOARM=6"},
	{Name: "mirror-darwin-amd64", GOOS: "darwin", GOARCH: "amd64", Tuning: "GOAMD64=v1"},
	{Name: "mirror-darwin-arm64", GOOS: "darwin", GOARCH: "arm64", Tuning: "GOARM64=v8.0"},
	{Name: "mirror-windows-amd64.exe", GOOS: "windows", GOARCH: "amd64", Tuning: "GOAMD64=v1"},
	{Name: "mirror-windows-arm64.exe", GOOS: "windows", GOARCH: "arm64", Tuning: "GOARM64=v8.0"},
}

func AssetNames() []string {
	names := make([]string, 0, 11)
	for _, target := range Targets {
		names = append(names, target.Name)
	}
	names = append(names, "guiho-s-mirror.zip", "guiho-i-mirror.md", "checksums.txt")
	sort.Strings(names)
	return names
}

func Validate() error {
	if len(Targets) != 8 {
		return fmt.Errorf("expected eight executable targets, got %d", len(Targets))
	}
	seen := map[string]bool{}
	counts := map[string]int{}
	for _, target := range Targets {
		if seen[target.Name] {
			return fmt.Errorf("duplicate target: %s", target.Name)
		}
		seen[target.Name] = true
		counts[target.GOOS]++
		if target.GOARCH == "amd64" && target.Tuning != "GOAMD64=v1" {
			return fmt.Errorf("%s must use GOAMD64=v1", target.Name)
		}
		if target.GOARCH == "arm64" && target.Tuning != "GOARM64=v8.0" {
			return fmt.Errorf("%s must use GOARM64=v8.0", target.Name)
		}
		if strings.Contains(target.Name, "windows") != strings.HasSuffix(target.Name, ".exe") {
			return fmt.Errorf("Windows extension mismatch: %s", target.Name)
		}
		if strings.Contains(target.Name, "v2") || strings.Contains(target.Name, "v3") || strings.Contains(target.Name, "v4") {
			return fmt.Errorf("unsupported performance variant: %s", target.Name)
		}
	}
	if counts["linux"] != 4 || counts["darwin"] != 2 || counts["windows"] != 2 {
		return fmt.Errorf("invalid OS distribution: %#v", counts)
	}
	if len(AssetNames()) != 11 {
		return fmt.Errorf("expected exactly eleven release assets")
	}
	return nil
}
