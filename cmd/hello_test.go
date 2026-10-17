package cmd

import (
	"strings"
	"testing"
)

func TestRenderHelloIsLeftAlignedWithoutCreatorLine(t *testing.T) {
	got := renderHello("linux", "amd64", "1.2.3", false)
	var expected strings.Builder
	expected.WriteString("\n")
	for _, line := range mirrorLogo {
		expected.WriteString(line + "\n")
	}
	expected.WriteString("Deterministic semantic versioning\n")
	expected.WriteString("GUIHO \u00b7 Crist\u00f3v\u00e3o GUIHO\n")
	expected.WriteString("\n")
	expected.WriteString("Platform  Linux x64\n")
	expected.WriteString("Version   v1.2.3\n")
	expected.WriteString("Author    GUIHO (www.guiho.co)\n")
	expected.WriteString("\n")
	expected.WriteString("Run mirror --help to see available commands.\n")
	expected.WriteString("\n")
	if got != expected.String() {
		t.Fatalf("hello output mismatch:\n got: %q\nwant: %q", got, expected.String())
	}
	if strings.Contains(got, "Creator") {
		t.Fatalf("hello output contains a Creator line:\n%s", got)
	}
	for _, line := range strings.Split(got, "\n") {
		if strings.HasPrefix(line, " ") {
			t.Fatalf("hello line is not left-aligned: %q", line)
		}
	}
}

func TestRenderHelloWithColorKeepsLeftAlignment(t *testing.T) {
	got := renderHello("windows", "arm64", "v1.2.3", true)
	for _, line := range strings.Split(got, "\n") {
		if strings.HasPrefix(line, " ") {
			t.Fatalf("coloured hello line is indented: %q", line)
		}
	}
	for _, required := range []string{
		ansiOrange + ansiBold + mirrorLogo[0] + ansiReset + "\n",
		ansiAccent + "GUIHO \u00b7 Crist\u00f3v\u00e3o GUIHO" + ansiReset + "\n\n" + ansiGray + "Platform" + ansiReset,
		ansiGray + "Version " + ansiReset + "  " + ansiAccent + "v1.2.3" + ansiReset + "\n" +
			ansiGray + "Author  " + ansiReset + "  " +
			ansiCream + "GUIHO (" + ansiReset + ansiAccent + "www.guiho.co" + ansiReset + ansiCream + ")" + ansiReset + "\n\nRun ",
	} {
		if !strings.Contains(got, required) {
			t.Fatalf("coloured hello omits %q:\n%q", got, required)
		}
	}
	if strings.Contains(got, "Creator") {
		t.Fatalf("coloured hello still shows the Creator line: %q", got)
	}
}
