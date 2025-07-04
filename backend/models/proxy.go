package models

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

// Proxy 表示反向代理配置
type Proxy struct {
	BaseModel
	Name        string `json:"name" gorm:"not null"`
	Description string `json:"description"`
	Path        string `json:"path" gorm:"not null;uniqueIndex"` // 前端访问路径
	TargetURL   string `json:"target_url" gorm:"not null"`       // 目标URL
	Enabled     bool   `json:"enabled" gorm:"default:true"`      // 是否启用
	StripPrefix bool   `json:"strip_prefix" gorm:"default:true"` // 是否去除前缀
}

// BeforeSave GORM钩子 - 保存前验证
func (p *Proxy) BeforeSave(tx *gorm.DB) error {
	// 确保路径以/开头
	if !strings.HasPrefix(p.Path, "/") {
		p.Path = "/" + p.Path
	}

	// 标准化路径：保留末尾斜杠或统一移除末尾斜杠
	// 在这里我们选择统一移除末尾斜杠（除非是根路径），这样在路由设置时更一致
	if p.Path != "/" && strings.HasSuffix(p.Path, "/") {
		p.Path = strings.TrimSuffix(p.Path, "/")
	}

	// 不允许路径为根路径或太短
	if p.Path == "/" {
		return errors.New("代理路径不能为根路径(/)")
	}

	// 确保路径至少包含两个字符
	if len(p.Path) < 2 {
		return errors.New("代理路径必须至少包含两个字符，如/a")
	}

	// 确保目标URL有效
	if !strings.HasPrefix(p.TargetURL, "http://") && !strings.HasPrefix(p.TargetURL, "https://") {
		return errors.New("目标URL必须以http://或https://开头")
	}

	return nil
}
