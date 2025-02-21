package utils

import (
	"encoding/json"
	"os"
)

func MapToStruct(m map[string]interface{}, s interface{}) (err error) {
	var marshal []byte
	marshal, err = json.Marshal(m)
	if err != nil {
		return err
	}
	err = json.Unmarshal(marshal, s)
	return
}

func Exists(filePath string) bool {
	_, err := os.Stat(filePath)
	if err == nil {
		return true
	}
	if os.IsNotExist(err) {
		return false
	}
	// 如果发生其他错误，可以在这里处理
	return false
}
