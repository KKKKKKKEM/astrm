package models

// LogLevel 定义日志级别
type LogLevel string

const (
	LogLevelDebug   LogLevel = "debug"
	LogLevelInfo    LogLevel = "info"
	LogLevelWarning LogLevel = "warning"
	LogLevelError   LogLevel = "error"
)

// Log 表示系统日志
type Log struct {
	BaseModel
	Source  string   `json:"source" gorm:"index"`      // 日志来源
	Level   LogLevel `json:"level" gorm:"index"`       // 日志级别
	Message string   `json:"message"`                  // 日志内容
	Details string   `json:"details" gorm:"type:text"` // 详细信息
}
