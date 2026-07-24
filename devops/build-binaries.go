/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
)

type BinaryTarget struct {
	GOOS      string
	GOARCH    string
	GOAMD64   string
	AssetName string
}

var BinaryTargets = []BinaryTarget{
	{GOOS: "linux", GOARCH: "arm64", GOAMD64: "", AssetName: "mirror-linux-arm64"},
	{GOOS: "linux", GOARCH: "amd64", GOAMD64: "v1", AssetName: "mirror-linux-x64"},
	{GOOS: "linux", GOARCH: "amd64", GOAMD64: "v1", AssetName: "mirror-linux-x64-baseline"},
	{GOOS: "linux", GOARCH: "amd64", GOAMD64: "v3", AssetName: "mirror-linux-x64-modern"},
	{GOOS: "darwin", GOARCH: "arm64", GOAMD64: "", AssetName: "mirror-darwin-arm64"},
	{GOOS: "darwin", GOARCH: "amd64", GOAMD64: "v1", AssetName: "mirror-darwin-x64"},
	{GOOS: "darwin", GOARCH: "amd64", GOAMD64: "v1", AssetName: "mirror-darwin-x64-baseline"},
	{GOOS: "darwin", GOARCH: "amd64", GOAMD64: "v3", AssetName: "mirror-darwin-x64-modern"},
	{GOOS: "windows", GOARCH: "arm64", GOAMD64: "", AssetName: "mirror-windows-arm64.exe"},
	{GOOS: "windows", GOARCH: "amd64", GOAMD64: "v1", AssetName: "mirror-windows-x64.exe"},
	{GOOS: "windows", GOARCH: "amd64", GOAMD64: "v1", AssetName: "mirror-windows-x64-baseline.exe"},
	{GOOS: "windows", GOARCH: "amd64", GOAMD64: "v3", AssetName: "mirror-windows-x64-modern.exe"},
}

var AgentAssetNames = []string{
	"guiho-s-mirror.md",
	"guiho-i-mirror.md",
}

func getExpectedReleaseAssetNames() []string {
	var names []string
	for _, target := range BinaryTargets {
		names = append(names, target.AssetName)
	}
	names = append(names, AgentAssetNames...)
	return names
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func getRootDir() string {
	dir, err := os.Getwd()
	if err != nil {
		log.Fatalf("failed to get working directory: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
		return dir
	}
	parent := filepath.Dir(dir)
	if _, err := os.Stat(filepath.Join(parent, "go.mod")); err == nil {
		return parent
	}
	return dir
}

func main() {
	root := getRootDir()
	binDir := filepath.Join(root, "bin")

	if err := os.MkdirAll(binDir, 0755); err != nil {
		log.Fatalf("failed to create bin directory: %v", err)
	}

	for _, target := range BinaryTargets {
		outPath := filepath.Join(binDir, target.AssetName)
		fmt.Printf("Building %s (%s/%s)...\n", target.AssetName, target.GOOS, target.GOARCH)

		cmd := exec.Command("go", "build", "-o", outPath, ".")
		cmd.Dir = root
		cmd.Env = append(os.Environ(),
			"CGO_ENABLED=0",
			"GOOS="+target.GOOS,
			"GOARCH="+target.GOARCH,
		)
		if target.GOAMD64 != "" {
			cmd.Env = append(cmd.Env, "GOAMD64="+target.GOAMD64)
		}

		out, err := cmd.CombinedOutput()
		if err != nil {
			log.Fatalf("failed to build %s: %v\nOutput: %s", target.AssetName, err, string(out))
		}
	}

	skillSrc := filepath.Join(root, "embed", "skills", "guiho-s-mirror.SKILL.md")
	skillDst := filepath.Join(binDir, "guiho-s-mirror.md")
	if err := copyFile(skillSrc, skillDst); err != nil {
		log.Printf("warning: failed to copy skill asset: %v", err)
	}

	promptSrc := filepath.Join(root, "embed", "prompts", "guiho-i-mirror.md")
	promptDst := filepath.Join(binDir, "guiho-i-mirror.md")
	if err := copyFile(promptSrc, promptDst); err != nil {
		log.Printf("warning: failed to copy prompt asset: %v", err)
	}

	expected := getExpectedReleaseAssetNames()
	sort.Strings(expected)
	fmt.Printf("Successfully built %d binaries and copied release assets to %s\n", len(BinaryTargets), binDir)
}
