package job

type Handler interface {
	Handle(job *Job) error
}
