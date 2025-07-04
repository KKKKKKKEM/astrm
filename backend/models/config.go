package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// ConfigType 表示配置类型
type ConfigType string

const (
	ConfigTypeSystem  ConfigType = "system"
	ConfigTypeUser    ConfigType = "user"
	ConfigTypeService ConfigType = "service"
)

// FieldType 表示配置字段类型
type FieldType string

const (
	FieldTypeText     FieldType = "text"
	FieldTypeNumber   FieldType = "number"
	FieldTypeSelect   FieldType = "select"
	FieldTypeTextarea FieldType = "textarea"
	FieldTypeSwitch   FieldType = "switch"
	FieldTypeDate     FieldType = "date"
)

// ConfigField 表示配置字段
type ConfigField struct {
	Key         string      `json:"key"`
	Label       string      `json:"label"`
	Type        FieldType   `json:"type"`
	Value       interface{} `json:"value"`
	Placeholder string      `json:"placeholder,omitempty"`
	Required    bool        `json:"required"`
	Options     []Option    `json:"options,omitempty"` // 用于select类型
}

// Option 表示选择类型的选项
type Option struct {
	Label string      `json:"label"`
	Value interface{} `json:"value"`
}

// ConfigFields 定义配置字段数组的自定义类型，用于JSON序列化
type ConfigFields []ConfigField

// Scan 实现sql.Scanner接口，用于从数据库读取JSON数据
func (c *ConfigFields) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("类型断言为[]byte失败")
	}

	return json.Unmarshal(bytes, c)
}

// Value 实现driver.Valuer接口，用于存储JSON数据到数据库
func (c ConfigFields) Value() (driver.Value, error) {
	return json.Marshal(c)
}

// Config 表示系统配置
type Config struct {
	BaseModel
	Name        string       `json:"name" gorm:"not null;uniqueIndex"`
	Description string       `json:"description"`
	Type        ConfigType   `json:"type" gorm:"default:'user'"`
	Fields      ConfigFields `json:"fields" gorm:"type:json"`
}
