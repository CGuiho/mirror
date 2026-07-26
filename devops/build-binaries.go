package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/CGuiho/mirror/pkg/release"
)

type buildOptions struct {
	root      string
	output    string
	version   string
	commit    string
	buildDate string
}

func main() {
	root, err := repositoryRoot()
	if err != nil {
		log.Fatal(err)
	}
	options := buildOptions{root: root}
	flag.StringVar(&options.output, "output", filepath.Join(root, "bin"), "Release asset output directory.")
	flag.StringVar(&options.version, "version", envOr("MIRROR_BUILD_VERSION", gitVersion(root)), "Semantic version embedded in every binary.")
	flag.StringVar(&options.commit, "commit", envOr("MIRROR_BUILD_COMMIT", gitValue(root, "rev-parse", "--short=12", "HEAD")), "Git commit embedded in every binary.")
	flag.StringVar(&options.buildDate, "build-date", envOr("MIRROR_BUILD_DATE", time.Now().UTC().Format(time.RFC3339)), "RFC3339 build timestamp embedded in every binary.")
	flag.Parse()

	if err := buildRelease(options); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Built exactly %d Mirror release assets in %s\n", len(release.AssetNames()), options.output)
}

func buildRelease(options buildOptions) error {
	if err := release.Validate(); err != nil {
		return err
	}
	if strings.TrimSpace(options.version) == "" {
		return fmt.Errorf("build version cannot be empty")
	}
	if _, err := time.Parse(time.RFC3339, options.buildDate); err != nil {
		return fmt.Errorf("build date must be RFC3339: %w", err)
	}
	absoluteOutput, err := filepath.Abs(options.output)
	if err != nil {
		return fmt.Errorf("resolve output directory: %w", err)
	}
	rootOutput := filepath.Join(options.root, "bin")
	if same, _ := filepath.Abs(rootOutput); absoluteOutput == same {
		if err := os.RemoveAll(absoluteOutput); err != nil {
			return fmt.Errorf("clean generated release directory: %w", err)
		}
	}
	if err := os.MkdirAll(absoluteOutput, 0o755); err != nil {
		return fmt.Errorf("create release directory: %w", err)
	}

	for _, target := range release.Targets {
		if err := buildTarget(options, absoluteOutput, target); err != nil {
			return err
		}
	}
	buildTime, _ := time.Parse(time.RFC3339, options.buildDate)
	if err := writeSkillZip(options.root, filepath.Join(absoluteOutput, "guiho-s-mirror.zip"), buildTime); err != nil {
		return err
	}
	if err := copyFile(
		filepath.Join(options.root, "embed", "prompts", "guiho-i-mirror.md"),
		filepath.Join(absoluteOutput, "guiho-i-mirror.md"),
	); err != nil {
		return fmt.Errorf("stage instruction asset: %w", err)
	}
	if err := writeChecksums(absoluteOutput); err != nil {
		return err
	}
	return nil
}

func buildTarget(options buildOptions, output string, target release.Target) error {
	ldflags := strings.Join([]string{
		"-s", "-w",
		"-X", "main.version=" + options.version,
		"-X", "main.commit=" + options.commit,
		"-X", "main.buildDate=" + options.buildDate,
		"-X", "main.buildTarget=" + target.Name,
	}, " ")
	command := exec.Command(
		"go", "build", "-trimpath", "-buildvcs=true", "-ldflags", ldflags,
		"-o", filepath.Join(output, target.Name), ".",
	)
	command.Dir = options.root
	command.Env = buildEnvironment(target)
	combined, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("build %s: %w\n%s", target.Name, err, strings.TrimSpace(string(combined)))
	}
	return nil
}

func buildEnvironment(target release.Target) []string {
	blocked := map[string]bool{
		"CGO_ENABLED": true, "GOOS": true, "GOARCH": true,
		"GOAMD64": true, "GOARM64": true, "GOARM": true,
	}
	environment := make([]string, 0, len(os.Environ())+4)
	for _, item := range os.Environ() {
		key, _, _ := strings.Cut(item, "=")
		if !blocked[key] {
			environment = append(environment, item)
		}
	}
	environment = append(environment, "CGO_ENABLED=0", "GOOS="+target.GOOS, "GOARCH="+target.GOARCH)
	if target.Tuning != "" {
		environment = append(environment, target.Tuning)
	}
	return environment
}

func writeSkillZip(root, destination string, modified time.Time) error {
	source := filepath.Join(root, "embed", "skills", "guiho-s-mirror", "SKILL.md")
	content, err := os.ReadFile(source)
	if err != nil {
		return fmt.Errorf("read embedded skill: %w", err)
	}
	file, err := os.Create(destination)
	if err != nil {
		return fmt.Errorf("create skill archive: %w", err)
	}
	archive := zip.NewWriter(file)
	header := &zip.FileHeader{Name: "guiho-s-mirror/SKILL.md", Method: zip.Deflate}
	header.SetMode(0o644)
	header.SetModTime(modified.UTC())
	entry, err := archive.CreateHeader(header)
	if err == nil {
		_, err = entry.Write(content)
	}
	closeArchiveErr := archive.Close()
	closeFileErr := file.Close()
	if err != nil {
		return fmt.Errorf("write skill archive: %w", err)
	}
	if closeArchiveErr != nil {
		return fmt.Errorf("close skill archive: %w", closeArchiveErr)
	}
	if closeFileErr != nil {
		return fmt.Errorf("close skill archive file: %w", closeFileErr)
	}
	return nil
}

func writeChecksums(directory string) error {
	names := release.AssetNames()
	manifestNames := make([]string, 0, len(names)-1)
	for _, name := range names {
		if name != "checksums.txt" {
			manifestNames = append(manifestNames, name)
		}
	}
	sort.Strings(manifestNames)
	var manifest strings.Builder
	for _, name := range manifestNames {
		digest, err := hashFile(filepath.Join(directory, name))
		if err != nil {
			return fmt.Errorf("hash %s: %w", name, err)
		}
		fmt.Fprintf(&manifest, "%s  %s\n", digest, name)
	}
	if err := os.WriteFile(filepath.Join(directory, "checksums.txt"), []byte(manifest.String()), 0o644); err != nil {
		return fmt.Errorf("write checksums.txt: %w", err)
	}
	return nil
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

func copyFile(source, destination string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.Create(destination)
	if err != nil {
		return err
	}
	if _, err := io.Copy(output, input); err != nil {
		output.Close()
		return err
	}
	return output.Close()
}

func repositoryRoot() (string, error) {
	directory, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(directory, "go.mod")); err == nil {
			return directory, nil
		}
		parent := filepath.Dir(directory)
		if parent == directory {
			return "", fmt.Errorf("go.mod not found from working directory")
		}
		directory = parent
	}
}

func gitVersion(root string) string {
	tag := gitValue(root, "describe", "--tags", "--match", "mirror/v*", "--abbrev=0")
	if strings.HasPrefix(tag, "mirror/v") {
		return strings.TrimPrefix(tag, "mirror/v")
	}
	return "dev"
}

func gitValue(root string, arguments ...string) string {
	command := exec.Command("git", arguments...)
	command.Dir = root
	output, err := command.Output()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(output))
}

func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
