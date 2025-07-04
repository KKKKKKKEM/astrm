package output

import (
	"sync"
)

// taskOutputChannels 存储每个任务的输出通道
var taskOutputChannels = make(map[string]chan string)
var taskOutputMutex sync.RWMutex

// GetTaskOutputChannel 获取任务输出通道
func GetTaskOutputChannel(taskID string) chan string {
	taskOutputMutex.Lock()
	defer taskOutputMutex.Unlock()

	// 如果通道不存在，创建一个新的
	if ch, exists := taskOutputChannels[taskID]; exists {
		return ch
	}

	// 创建一个有缓冲的通道
	ch := make(chan string, 100)
	taskOutputChannels[taskID] = ch

	return ch
}

// CloseTaskOutputChannel 关闭任务输出通道
func CloseTaskOutputChannel(taskID string) {
	taskOutputMutex.Lock()
	defer taskOutputMutex.Unlock()

	if ch, exists := taskOutputChannels[taskID]; exists {
		close(ch)
		delete(taskOutputChannels, taskID)
	}
}
