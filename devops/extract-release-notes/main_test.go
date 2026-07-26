package main

import (
	"strings"
	"testing"
)

func TestGoReleaseTagPattern(t *testing.T) {
	for _, tag := range []string{"mirror/v3.8.0", "mirror/v3.9.0-rc.1"} {
		if !tagPattern.MatchString(tag) {
			t.Fatalf("valid tag rejected: %s", tag)
		}
	}
	for _, tag := range []string{"@guiho/mirror@3.8.0", "v3.8.0", "@guiho/mirror/v3.8.0"} {
		if tagPattern.MatchString(tag) {
			t.Fatalf("legacy tag accepted: %s", tag)
		}
	}
}

func TestExtractVersionSectionWithReleaseDate(t *testing.T) {
	changelog := "# Changelog\n\n## 3.8.0 - 2026-07-24\n\n- Go rewrite.\n\n## 3.7.4 - 2026-07-23\n\n- Legacy.\n"
	notes, err := extractVersionSection(changelog, "3.8.0")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(notes, "Go rewrite") || strings.Contains(notes, "Legacy") {
		t.Fatalf("unexpected exact-version notes:\n%s", notes)
	}
}

func TestExtractVersionSectionRejectsMissingDuplicateAndEmpty(t *testing.T) {
	cases := []string{
		"## 3.7.4\n\n- old\n",
		"## 3.8.0\n\n- one\n\n## 3.8.0 - 2026-07-24\n\n- two\n",
		"## 3.8.0\n\n## 3.7.4\n\n- old\n",
	}
	for _, changelog := range cases {
		if _, err := extractVersionSection(changelog, "3.8.0"); err == nil {
			t.Fatalf("invalid changelog accepted:\n%s", changelog)
		}
	}
}
