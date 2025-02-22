package main

import (
	"astrm/modules"
	"astrm/server"
	"flag"
)

var (
	configPath = *flag.String("config", "conf/conf.yaml", "config file path")
)

func init() {
	flag.Parse()
}

func main() {
	server.Init(configPath)
	modules.Init()
	server.Run()
}
