package config

import (
	"github.com/spf13/viper"
)

// AppConfig 表示应用全局配置
type AppConfig struct {
	Server ServerConfig `mapstructure:"server"`
	DB     DBConfig     `mapstructure:"db"`
}

// ServerConfig 表示服务器配置
type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port string `mapstructure:"port"`
	Mode string `mapstructure:"mode"`
}

// DBConfig 表示数据库配置
type DBConfig struct {
	Type string `mapstructure:"type"`
	Path string `mapstructure:"path"`
}

// LoadConfig 加载配置文件
func LoadConfig() (*AppConfig, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")

	// 设置默认值
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.mode", "release")
	viper.SetDefault("db.type", "sqlite")
	viper.SetDefault("db.path", "astrm.db")

	err := viper.ReadInConfig()
	if err != nil {
		// 如果配置文件不存在，创建默认配置
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			err = viper.SafeWriteConfig()
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	var config AppConfig
	err = viper.Unmarshal(&config)
	return &config, err
}
