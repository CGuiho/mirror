/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package hooks

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/CGuiho/mirror/pkg/config"
)

type Result struct {
	Event      config.HookEvent `json:"event"`
	Kind       string           `json:"kind"`
	Index      int              `json:"index"`
	Status     string           `json:"status"`
	DurationMS int64            `json:"duration_ms"`
	ExitCode   *int             `json:"exit_code,omitempty"`
	Stdout     string           `json:"stdout,omitempty"`
	Stderr     string           `json:"stderr,omitempty"`
}

type Context struct {
	Stage          string   `json:"stage,omitempty"`
	Source         string   `json:"source,omitempty"`
	Output         []string `json:"output,omitempty"`
	CurrentVersion string   `json:"current_version,omitempty"`
	NextVersion    string   `json:"next_version,omitempty"`
	ProjectName    string   `json:"project_name,omitempty"`
	GitTag         string   `json:"git_tag,omitempty"`
	FilePaths      []string `json:"file_paths,omitempty"`
	CommitMessage  string   `json:"commit_message,omitempty"`
	CommitPaths    []string `json:"commit_paths,omitempty"`
	Tag            string   `json:"tag,omitempty"`
	PushCommit     bool     `json:"push_commit"`
	PushTag        bool     `json:"push_tag"`
	Applied        bool     `json:"applied"`
	DryRun         bool     `json:"dry_run"`
	Completed      []string `json:"completed,omitempty"`
	ErrorStage     string   `json:"error_stage,omitempty"`
	ErrorMessage   string   `json:"error_message,omitempty"`
	ErrorExitCode  *int     `json:"error_exit_code,omitempty"`
	Secondary      []string `json:"secondary_errors,omitempty"`
}

type CommandOutput struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

type CommandRunner interface {
	Run(context.Context, string, string, []string) (CommandOutput, error)
}

type ExecRunner struct{}

func (ExecRunner) Run(ctx context.Context, cwd, command string, environment []string) (CommandOutput, error) {
	name := "/bin/sh"
	args := []string{"-c", command}
	if runtime.GOOS == "windows" {
		name = os.Getenv("COMSPEC")
		if strings.TrimSpace(name) == "" {
			name = "cmd.exe"
		}
		args = []string{"/d", "/s", "/c", command}
	}

	process := exec.CommandContext(ctx, name, args...)
	process.Dir = cwd
	process.Env = environment
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	process.Stdout = &stdout
	process.Stderr = &stderr
	err := process.Run()
	output := CommandOutput{Stdout: stdout.String(), Stderr: stderr.String(), ExitCode: 0}
	if err == nil {
		return output, nil
	}
	if ctx.Err() != nil {
		output.ExitCode = -1
		return output, ctx.Err()
	}
	var exitError *exec.ExitError
	if errors.As(err, &exitError) {
		output.ExitCode = exitError.ExitCode()
		return output, nil
	}
	output.ExitCode = -1
	return output, err
}

type Options struct {
	Config      config.HooksConfig
	CWD         string
	ConfigPath  string
	Target      string
	Runner      CommandRunner
	Environment []string
	TempDir     string
	Reporter    io.Writer
	JSON        bool
}

type Session struct {
	config      config.HooksConfig
	cwd         string
	configPath  string
	target      string
	runner      CommandRunner
	environment []string
	contextPath string
	reporter    io.Writer
	json        bool
	results     []Result
	secondary   []error
}

func NewSession(options Options) (*Session, error) {
	absoluteCWD, err := filepath.Abs(options.CWD)
	if err != nil {
		return nil, fmt.Errorf("resolve hook working directory: %w", err)
	}
	if options.Runner == nil {
		options.Runner = ExecRunner{}
	}
	if options.Environment == nil {
		options.Environment = os.Environ()
	}
	session := &Session{
		config:      options.Config,
		cwd:         absoluteCWD,
		configPath:  options.ConfigPath,
		target:      options.Target,
		runner:      options.Runner,
		environment: append([]string(nil), options.Environment...),
		reporter:    options.Reporter,
		json:        options.JSON,
		results:     []Result{},
		secondary:   []error{},
	}
	if !options.Config.HasCommands() {
		return session, nil
	}
	temporary, err := os.CreateTemp(options.TempDir, "mirror-hook-context-*.json")
	if err != nil {
		return nil, fmt.Errorf("create hook context: %w", err)
	}
	session.contextPath = temporary.Name()
	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		os.Remove(session.contextPath)
		return nil, fmt.Errorf("protect hook context: %w", err)
	}
	if err := temporary.Close(); err != nil {
		os.Remove(session.contextPath)
		return nil, fmt.Errorf("close hook context: %w", err)
	}
	return session, nil
}

func (session *Session) ContextPath() string {
	return session.contextPath
}

func (session *Session) Results() []Result {
	return append([]Result(nil), session.results...)
}

func (session *Session) SecondaryErrors() []error {
	return append([]error(nil), session.secondary...)
}

func (session *Session) Cleanup() error {
	if session == nil || session.contextPath == "" {
		return nil
	}
	err := os.Remove(session.contextPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func (session *Session) Run(ctx context.Context, event config.HookEvent, hookContext Context) error {
	errors := session.run(ctx, event, hookContext, false)
	if len(errors) == 0 {
		return nil
	}
	return errors[0]
}

func (session *Session) RunBestEffort(ctx context.Context, event config.HookEvent, hookContext Context) []error {
	failures := session.run(ctx, event, hookContext, true)
	session.secondary = append(session.secondary, failures...)
	return failures
}

func (session *Session) run(ctx context.Context, event config.HookEvent, hookContext Context, continueOnError bool) []error {
	if session == nil {
		return nil
	}
	commands := session.config[event].Commands
	if len(commands) == 0 {
		return nil
	}
	failures := make([]error, 0)
	for index, command := range commands {
		if err := session.writeContext(event, hookContext); err != nil {
			failure := &CommandError{Event: event, Index: index + 1, Command: command, ExitCode: -1, Err: err}
			exitCode := -1
			session.record(Result{
				Event: event, Kind: "command", Index: index + 1,
				Status: "failure", DurationMS: 0, ExitCode: &exitCode,
			})
			failures = append(failures, failure)
			if !continueOnError {
				session.recordSkipped(event, index+1, len(commands))
				break
			}
			continue
		}

		started := time.Now()
		output, err := session.runner.Run(ctx, session.cwd, command, session.environmentFor(event, hookContext))
		duration := time.Since(started).Milliseconds()
		result := Result{
			Event: event, Kind: "command", Index: index + 1, Status: "success",
			DurationMS: duration, Stdout: output.Stdout, Stderr: output.Stderr,
		}
		if err != nil || output.ExitCode != 0 {
			result.Status = "failure"
			if output.ExitCode >= 0 {
				exitCode := output.ExitCode
				result.ExitCode = &exitCode
			}
			failure := &CommandError{
				Event: event, Index: index + 1, Command: command,
				ExitCode: output.ExitCode, Err: err,
			}
			session.record(result)
			failures = append(failures, failure)
			if !continueOnError {
				session.recordSkipped(event, index+1, len(commands))
				break
			}
			continue
		}
		exitCode := 0
		result.ExitCode = &exitCode
		session.record(result)
	}
	_ = session.writeContext(event, hookContext)
	return failures
}

func (session *Session) recordSkipped(event config.HookEvent, completed, total int) {
	for index := completed + 1; index <= total; index++ {
		session.record(Result{Event: event, Kind: "command", Index: index, Status: "skipped"})
	}
}

func (session *Session) record(result Result) {
	session.results = append(session.results, result)
	if session.reporter == nil || session.json || result.Status == "skipped" {
		return
	}
	prefix := fmt.Sprintf("[mirror:hook:%s:%d]", result.Event, result.Index)
	fmt.Fprintf(session.reporter, "%s %s (%dms)\n", prefix, result.Status, result.DurationMS)
	if result.Stdout != "" {
		fmt.Fprintf(session.reporter, "%s stdout:\n%s", prefix, ensureTrailingNewline(result.Stdout))
	}
	if result.Stderr != "" {
		fmt.Fprintf(session.reporter, "%s stderr:\n%s", prefix, ensureTrailingNewline(result.Stderr))
	}
}

func (session *Session) writeContext(event config.HookEvent, hookContext Context) error {
	if session.contextPath == "" {
		return nil
	}
	document := struct {
		Event      config.HookEvent `json:"event"`
		Kind       string           `json:"kind"`
		CWD        string           `json:"cwd"`
		ConfigPath string           `json:"config_path"`
		Target     string           `json:"target"`
		Context    Context          `json:"context"`
		Results    []Result         `json:"results"`
	}{
		Event: event, Kind: "command", CWD: session.cwd,
		ConfigPath: session.configPath, Target: session.target,
		Context: hookContext, Results: session.Results(),
	}
	data, err := json.MarshalIndent(document, "", "  ")
	if err != nil {
		return fmt.Errorf("encode hook context: %w", err)
	}
	data = append(data, '\n')
	file, err := os.CreateTemp(filepath.Dir(session.contextPath), ".mirror-hook-context-*.json")
	if err != nil {
		return fmt.Errorf("create staged hook context: %w", err)
	}
	stagedPath := file.Name()
	defer os.Remove(stagedPath)
	if err := file.Chmod(0o600); err != nil {
		file.Close()
		return fmt.Errorf("protect staged hook context: %w", err)
	}
	if _, err := file.Write(data); err != nil {
		file.Close()
		return fmt.Errorf("write hook context: %w", err)
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return fmt.Errorf("sync hook context: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close hook context: %w", err)
	}
	if err := replaceFile(stagedPath, session.contextPath); err != nil {
		return fmt.Errorf("replace hook context: %w", err)
	}
	return nil
}

func (session *Session) environmentFor(event config.HookEvent, hookContext Context) []string {
	values := map[string]string{
		"MIRROR_HOOK_EVENT":     string(event),
		"MIRROR_HOOK_KIND":      "command",
		"MIRROR_CWD":            session.cwd,
		"MIRROR_CONFIG_PATH":    session.configPath,
		"MIRROR_TARGET":         session.target,
		"MIRROR_CONTEXT_PATH":   session.contextPath,
		"MIRROR_SOURCE":         hookContext.Source,
		"MIRROR_OUTPUT":         strings.Join(hookContext.Output, ","),
		"MIRROR_CURRENT":        hookContext.CurrentVersion,
		"MIRROR_NEXT":           hookContext.NextVersion,
		"MIRROR_PROJECT_NAME":   hookContext.ProjectName,
		"MIRROR_GIT_TAG":        hookContext.GitTag,
		"MIRROR_FILE_PATHS":     strings.Join(hookContext.FilePaths, string(os.PathListSeparator)),
		"MIRROR_COMMIT_MESSAGE": hookContext.CommitMessage,
		"MIRROR_COMMIT_PATHS":   strings.Join(hookContext.CommitPaths, string(os.PathListSeparator)),
		"MIRROR_TAG":            hookContext.Tag,
		"MIRROR_PUSH_COMMIT":    strconv.FormatBool(hookContext.PushCommit),
		"MIRROR_PUSH_TAG":       strconv.FormatBool(hookContext.PushTag),
		"MIRROR_ERROR_STAGE":    hookContext.ErrorStage,
		"MIRROR_ERROR_MESSAGE":  hookContext.ErrorMessage,
		"MIRROR_APPLIED":        strconv.FormatBool(hookContext.Applied),
	}
	if hookContext.ErrorExitCode != nil {
		values["MIRROR_ERROR_EXIT_CODE"] = strconv.Itoa(*hookContext.ErrorExitCode)
	}
	return mergeEnvironment(session.environment, values)
}

func mergeEnvironment(base []string, overlays map[string]string) []string {
	values := map[string]string{}
	for _, entry := range base {
		name, value, found := strings.Cut(entry, "=")
		if found {
			values[name] = value
		}
	}
	for name, value := range overlays {
		values[name] = value
	}
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	sort.Strings(names)
	environment := make([]string, 0, len(names))
	for _, name := range names {
		environment = append(environment, name+"="+values[name])
	}
	return environment
}

type CommandError struct {
	Event    config.HookEvent
	Index    int
	Command  string
	ExitCode int
	Err      error
}

func (hookError *CommandError) Error() string {
	detail := ""
	if hookError.Err != nil {
		detail = ": " + hookError.Err.Error()
	}
	if hookError.ExitCode >= 0 {
		return fmt.Sprintf("hook %s command %d failed with exit code %d%s", hookError.Event, hookError.Index, hookError.ExitCode, detail)
	}
	return fmt.Sprintf("hook %s command %d failed%s", hookError.Event, hookError.Index, detail)
}

func (hookError *CommandError) Unwrap() error {
	return hookError.Err
}

func ExitCode(err error) *int {
	var hookError *CommandError
	if errors.As(err, &hookError) && hookError.ExitCode >= 0 {
		exitCode := hookError.ExitCode
		return &exitCode
	}
	return nil
}

type LifecycleError struct {
	Primary   error
	Secondary []error
}

func (lifecycleError *LifecycleError) Error() string {
	if len(lifecycleError.Secondary) == 0 {
		return lifecycleError.Primary.Error()
	}
	messages := make([]string, 0, len(lifecycleError.Secondary))
	for _, err := range lifecycleError.Secondary {
		messages = append(messages, err.Error())
	}
	return fmt.Sprintf("%s (secondary hook failures: %s)", lifecycleError.Primary, strings.Join(messages, "; "))
}

func (lifecycleError *LifecycleError) Unwrap() error {
	return lifecycleError.Primary
}

func WithSecondary(primary error, secondary []error) error {
	if primary == nil {
		if len(secondary) == 0 {
			return nil
		}
		primary = secondary[0]
		secondary = secondary[1:]
	}
	if len(secondary) == 0 {
		return primary
	}
	return &LifecycleError{Primary: primary, Secondary: append([]error(nil), secondary...)}
}

func Strings(errors []error) []string {
	values := make([]string, 0, len(errors))
	for _, err := range errors {
		values = append(values, err.Error())
	}
	return values
}

func ensureTrailingNewline(value string) string {
	if strings.HasSuffix(value, "\n") {
		return value
	}
	return value + "\n"
}
