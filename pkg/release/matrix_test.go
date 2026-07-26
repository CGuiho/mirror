package release

import (
	"slices"
	"testing"
)

func TestExactElevenArtifactContract(t *testing.T) {
	if err := Validate(); err != nil {
		t.Fatal(err)
	}
	expected := []string{
		"checksums.txt",
		"guiho-i-mirror.md",
		"guiho-s-mirror.zip",
		"mirror-darwin-amd64",
		"mirror-darwin-arm64",
		"mirror-linux-amd64",
		"mirror-linux-arm64",
		"mirror-linux-armv6",
		"mirror-linux-armv7",
		"mirror-windows-amd64.exe",
		"mirror-windows-arm64.exe",
	}
	if !slices.Equal(AssetNames(), expected) {
		t.Fatalf("unexpected release assets: %#v", AssetNames())
	}
}
