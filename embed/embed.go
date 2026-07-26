package embed

import (
	"embed"
)

// FS holds the embedded agent skills and documentation assets for Mirror.
//
//go:embed skills/guiho-s-mirror/** prompts/*
var FS embed.FS
