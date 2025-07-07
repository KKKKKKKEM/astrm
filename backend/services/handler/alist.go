package handler

import (
	"astrm/backend/models"
	"fmt"
	"time"
)

type AlistHandlers struct {
}

func NewAlistHandler() *AlistHandlers {
	return &AlistHandlers{}
}

func (h *AlistHandlers) Handle(task *models.Task, log chan<- string) (result any, err error) {

	log <- fmt.Sprintf("任务开始了: %s", task.Name)
	log <- fmt.Sprintf("任务参数: %s", task.Opts)
	time.Sleep(time.Second * 3)
	log <- fmt.Sprintf("任务运行中 1: %s", task.Name)
	time.Sleep(time.Second * 3)
	log <- fmt.Sprintf("任务运行中2: %s", task.Name)
	time.Sleep(time.Second * 3)
	log <- fmt.Sprintf("任务运行中3: %s", task.Name)
	time.Sleep(time.Second * 3)
	log <- fmt.Sprintf("任务 结束了: %s", task.Name)

	return

}
