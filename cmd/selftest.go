package cmd

import (
	"fmt"
	"io/fs"
	"strings"

	embedFS "github.com/CGuiho/mirror/embed"
	"github.com/CGuiho/mirror/pkg/updater"
	"github.com/spf13/cobra"
)

func newSelfTestCommand(info BuildInfo) *cobra.Command {
	return &cobra.Command{
		Use:    "__self-test",
		Hidden: true,
		Args:   cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			if strings.TrimSpace(info.Version) == "" {
				return fmt.Errorf("embedded version is empty")
			}
			if _, err := updater.TargetAsset(info.Target); err != nil {
				return err
			}
			for _, path := range []string{
				"skills/guiho-s-mirror/SKILL.md",
				"prompts/guiho-i-mirror.md",
				"prompts/guiho-p-mirror-install.md",
				"prompts/guiho-p-mirror-uninstall.md",
			} {
				content, err := fs.ReadFile(embedFS.FS, path)
				if err != nil {
					return fmt.Errorf("read embedded resource %s: %w", path, err)
				}
				if len(content) == 0 {
					return fmt.Errorf("embedded resource is empty: %s", path)
				}
			}
			return nil
		},
	}
}
