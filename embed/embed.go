package embed

import (
	"embed"
)

// FS holds the embedded agent skills and documentation assets for Mirror.
//
//go:embed skills/* prompts/*
var FS embed.FS
