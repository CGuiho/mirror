package main

import (
	"archive/zip"
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/CGuiho/mirror/pkg/release"
)

func main() {
	directory := flag.String("directory", "bin", "Release asset directory.")
	flag.Parse()
	result, err := verify(*directory)
	if err != nil {
		log.Fatal(err)
	}
	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(encoded))
}

type verification struct {
	Count     int      `json:"count"`
	Assets    []string `json:"assets"`
	Checksums int      `json:"checksums"`
}

func verify(directory string) (verification, error) {
	if err := release.Validate(); err != nil {
		return verification{}, err
	}
	entries, err := os.ReadDir(directory)
	if err != nil {
		return verification{}, fmt.Errorf("read release directory: %w", err)
	}
	observed := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			observed = append(observed, entry.Name())
		}
	}
	sort.Strings(observed)
	expected := release.AssetNames()
	if !slices.Equal(observed, expected) {
		return verification{}, fmt.Errorf("release assets differ\nexpected: %s\nobserved: %s", strings.Join(expected, ", "), strings.Join(observed, ", "))
	}
	if err := verifyMarkdown(filepath.Join(directory, "guiho-i-mirror.md"), "guiho-i-mirror"); err != nil {
		return verification{}, err
	}
	if err := verifySkillZip(filepath.Join(directory, "guiho-s-mirror.zip")); err != nil {
		return verification{}, err
	}
	count, err := verifyChecksums(directory)
	if err != nil {
		return verification{}, err
	}
	return verification{Count: len(observed), Assets: observed, Checksums: count}, nil
}

func verifyMarkdown(path, expectedName string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", filepath.Base(path), err)
	}
	if len(data) == 0 || !utf8.Valid(data) || strings.IndexByte(string(data), 0) >= 0 {
		return fmt.Errorf("%s is not valid non-empty UTF-8 Markdown", filepath.Base(path))
	}
	normalized := strings.ReplaceAll(string(data), "\r\n", "\n")
	if !strings.HasPrefix(normalized, "---\n") || !strings.Contains(normalized, "\nname: "+expectedName+"\n") {
		return fmt.Errorf("%s has invalid frontmatter identity", filepath.Base(path))
	}
	return nil
}

func verifySkillZip(path string) error {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return fmt.Errorf("open skill archive: %w", err)
	}
	defer archive.Close()
	if len(archive.File) != 1 || archive.File[0].Name != "guiho-s-mirror/SKILL.md" {
		return fmt.Errorf("skill archive must contain only guiho-s-mirror/SKILL.md")
	}
	reader, err := archive.File[0].Open()
	if err != nil {
		return err
	}
	data, err := io.ReadAll(io.LimitReader(reader, 1<<20))
	reader.Close()
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp("", "mirror-skill-*.md")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if _, err := temporary.Write(data); err != nil {
		temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return verifyMarkdown(temporaryPath, "guiho-s-mirror")
}

func verifyChecksums(directory string) (int, error) {
	file, err := os.Open(filepath.Join(directory, "checksums.txt"))
	if err != nil {
		return 0, err
	}
	defer file.Close()
	observed := map[string]string{}
	ordered := []string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) != 2 || len(fields[0]) != sha256.Size*2 {
			return 0, fmt.Errorf("invalid checksums.txt line: %q", scanner.Text())
		}
		name := strings.TrimPrefix(fields[1], "*")
		if _, exists := observed[name]; exists {
			return 0, fmt.Errorf("duplicate checksum entry: %s", name)
		}
		observed[name] = strings.ToLower(fields[0])
		ordered = append(ordered, name)
	}
	if err := scanner.Err(); err != nil {
		return 0, err
	}
	expectedNames := make([]string, 0, len(release.AssetNames())-1)
	for _, name := range release.AssetNames() {
		if name != "checksums.txt" {
			expectedNames = append(expectedNames, name)
		}
	}
	if !slices.Equal(ordered, expectedNames) {
		return 0, fmt.Errorf("checksums.txt filenames are incomplete or not sorted")
	}
	for _, name := range expectedNames {
		digest, err := hashFile(filepath.Join(directory, name))
		if err != nil {
			return 0, err
		}
		if observed[name] != digest {
			return 0, fmt.Errorf("checksum mismatch for %s", name)
		}
	}
	return len(observed), nil
}

func hashFile(path string) (string, error) {
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
