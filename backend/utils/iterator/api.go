package iterator

import "context"

type Data[T any] struct {
	Content T
	Error   error
}
type Iterator[T any] struct {
	Ctx    context.Context
	Cancel context.CancelFunc
	ch     <-chan Data[T]
}

func Make[T any](do func(ctx context.Context, ch chan<- Data[T])) *Iterator[T] {
	ctx, cancel := context.WithCancel(context.Background())
	ch := make(chan Data[T], 1)
	go func() {
		defer close(ch)
		do(ctx, ch)
	}()
	return &Iterator[T]{Ctx: ctx, Cancel: cancel, ch: ch}
}

func (i *Iterator[T]) Iter() <-chan Data[T] {
	return i.ch
}
