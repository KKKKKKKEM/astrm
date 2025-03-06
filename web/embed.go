package web

import "embed"

//go:embed *
var Web embed.FS

//go:embed static/*
var Static embed.FS
