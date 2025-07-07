package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("astrm.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	// 自动迁移表结构
	err = DB.AutoMigrate(
		&Task{},
		&Config{},
		&Log{},
		&Proxy{},
		&TaskLog{},
		//&ProxyPlugin{},
	)

	return err
}

// BaseModel 为所有模型提供基础字段
type BaseModel struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate 在创建记录前生成UUID
func (m *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}
