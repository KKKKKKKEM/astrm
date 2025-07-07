package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"strings"

	"gorm.io/gorm"
)

type Pluginlice []ProxyPlugin

// Value - 实现 driver.Valuer 接口, 入库
func (s Pluginlice) Value() (driver.Value, error) {
	if len(s) == 0 {
		return ``, nil // 对于空切片，存为 NULL
	}
	// 将 []string 序列化为 JSON 格式的 []byte
	return json.Marshal(s)
}

// Scan - 实现 sql.Scanner 接口, 出库
func (s *Pluginlice) Scan(value interface{}) error {
	if value == nil {
		*s = nil // 如果数据库中的值是 NULL，则将切片设为 nil
		return nil
	}
	// 将 JSON 格式的 []byte 反序列化为 []string
	return json.Unmarshal(value.([]byte), s)
}

// Proxy 表示反向代理配置
type Proxy struct {
	BaseModel
	Name        string     `json:"name" gorm:"not null"`
	Description string     `json:"description"`
	Path        string     `json:"path" gorm:"not null;uniqueIndex"` // 前端访问路径
	TargetURL   string     `json:"target_url" gorm:"not null"`       // 目标URL
	Enabled     bool       `json:"enabled" gorm:"default:true"`      // 是否启用
	StripPrefix bool       `json:"strip_prefix" gorm:"default:true"` // 是否去除前缀
	Plugins     Pluginlice `json:"plugins"`
}

// ProxyPlugin 存储挂载到代理上的插件配置
type ProxyPlugin struct {
	Name  string `json:"name"`  // 插件名称，如 "RedirectPlugin"
	Regex string `json:"regex"` // 触发此插件的 URL 正则表达式
	// 使用 text 类型存储插件的 JSON 配置字符串，灵活性高
	Config string `json:"config" gorm:"type:text"`
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
