package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

var tagPattern = regexp.MustCompile(`^mirror/v([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)$`)

func main() {
	if len(os.Args) != 4 {
		fatal("usage: go run ./devops/extract-release-notes <tag> <changelog> <output>")
	}
	match := tagPattern.FindStringSubmatch(os.Args[1])
	if match == nil {
		fatal("invalid Mirror Go release tag: " + os.Args[1])
	}
	content, err := os.ReadFile(os.Args[2])
	if err != nil {
		fatal(err.Error())
	}
	notes, err := extractVersionSection(string(content), match[1])
	if err != nil {
		fatal(err.Error())
	}
	if err := os.WriteFile(os.Args[3], []byte(notes), 0o644); err != nil {
		fatal(err.Error())
	}
}

func extractVersionSection(content, version string) (string, error) {
	heading := "## " + version
	bracketedHeading := "## [" + version + "]"
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	start := -1
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if isVersionHeading(trimmed, heading) || isVersionHeading(trimmed, bracketedHeading) {
			if start != -1 {
				return "", fmt.Errorf("duplicate changelog section for %s", version)
			}
			start = index
		}
	}
	if start == -1 {
		return "", fmt.Errorf("missing changelog section for %s", version)
	}
	end := len(lines)
	for index := start + 1; index < len(lines); index++ {
		if strings.HasPrefix(lines[index], "## ") {
			end = index
			break
		}
	}
	body := strings.TrimSpace(strings.Join(lines[start+1:end], "\n"))
	if body == "" {
		return "", fmt.Errorf("empty changelog section for %s", version)
	}
	return strings.TrimSpace(strings.Join(lines[start:end], "\n")) + "\n", nil
}

func isVersionHeading(line, heading string) bool {
	return line == heading || strings.HasPrefix(line, heading+" - ")
}

func fatal(message string) {
	fmt.Fprintln(os.Stderr, message)
	os.Exit(1)
}
