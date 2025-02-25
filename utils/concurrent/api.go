package concurrent

import (
	"context"
	"errors"
	"reflect"
	"sync"
)

// Task represents a task that can be submitted to the thread pool.
type Task struct {
	f    any
	args []any
	done chan []any
}

// Future is an interface for getting the result of a task.
type Future interface {
	Get() []any
}

// futureImpl implements the Future interface.
type futureImpl struct {
	resultChan <-chan []any
}

func (f *futureImpl) Get() []any {
	result := <-f.resultChan
	return result
}

// Pool represents a pool of workers and a job queue.
type Pool struct {
	tasks     chan *Task
	semaphore chan any
	wg        sync.WaitGroup
	ctx       context.Context
	cancelCtx context.CancelFunc
}

// NewPool creates a new Pool with the specified number of workers.
func NewPool(numWorkers int) *Pool {
	ctx, cancel := context.WithCancel(context.Background())
	tp := &Pool{
		tasks:     make(chan *Task, numWorkers),
		semaphore: make(chan any, numWorkers),
		ctx:       ctx,
		cancelCtx: cancel,
	}

	for i := 0; i < numWorkers; i++ {
		tp.wg.Add(1)
		go tp.worker(i)
	}

	return tp
}

// worker processes tasks from the task channel.
func (tp *Pool) worker(_ int) {
	defer tp.wg.Done()
	for {
		select {
		case task, ok := <-tp.tasks:
			if !ok {
				return // Channel closed, exit
			}
			result := callFunction(task.f, task.args...)
			task.done <- result
			<-tp.semaphore
		case <-tp.ctx.Done():
			return // Context cancelled, exit
		}
	}
}

// Submit submits a task to the thread pool and returns a Future.
func (tp *Pool) Submit(fn any, args ...any) (fu Future) {
	fnVal := reflect.ValueOf(fn)
	if fnVal.Kind() != reflect.Func {
		panic(errors.New("provided value is not a function"))
	}
	done := make(chan []any, 1)
	task := &Task{f: fn, done: done, args: args}
	tp.semaphore <- new(any)
	tp.tasks <- task
	fu = &futureImpl{resultChan: done}
	return
}

// callFunction uses reflection to call the function with the provided arguments.
func callFunction(fn interface{}, args ...interface{}) []any {
	fnVal := reflect.ValueOf(fn)
	in := make([]reflect.Value, len(args))
	for i, arg := range args {
		in[i] = reflect.ValueOf(arg)
	}

	results := fnVal.Call(in)
	// 将结果转换为接口切片
	out := make([]interface{}, len(results))
	for i, result := range results {
		out[i] = result.Interface()
	}
	return out
}

// Shutdown gracefully shuts down the thread pool.
func (tp *Pool) Shutdown() {
	close(tp.tasks)
	tp.cancelCtx()
	tp.wg.Wait()
}

func (tp *Pool) Wait() {
	tp.wg.Wait()
}
