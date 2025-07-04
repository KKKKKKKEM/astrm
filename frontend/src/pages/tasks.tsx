import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, Trash2, Play, Plus, Pencil } from 'lucide-react'
import { TasksApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function Tasks() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', page],
    queryFn: () => TasksApi.getAll({ page, pageSize: 10 }),
  })

  const runMutation = useMutation({
    mutationFn: TasksApi.run,
    onSuccess: (taskId) => {
      toast.success('任务已开始执行')

      // 立即刷新获取状态更新
      queryClient.invalidateQueries({ queryKey: ['tasks'] })

      // 定期刷新以更新任务状态
      const refreshInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      }, 3000) // 每3秒刷新一次

      // 60秒后停止自动刷新
      setTimeout(() => {
        clearInterval(refreshInterval)
      }, 60000)

      // 导航到任务详情页面
      navigate(`/tasks/${taskId}`)
    },
    onError: (error) => {
      toast.error(`执行失败: ${error instanceof Error ? error.message : '未知错误'}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: TasksApi.delete,
    onSuccess: () => {
      toast.success('任务已删除')
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => {
      toast.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    },
  })

  const handleRunTask = (id: string) => {
    runMutation.mutate(id)
  }

  const handleDeleteTask = (id: string) => {
    deleteMutation.mutate(id)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const totalPages = Math.ceil((data?.total || 0) / 10)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">任务管理</h2>
          <p className="text-muted-foreground">查看和管理系统任务</p>
        </div>
        <Button onClick={() => navigate('/tasks/new')}>
          <Plus className="mr-2 h-4 w-4" /> 新建任务
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
          <CardDescription>
            共有 {data?.total || 0} 个任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-4">加载中...</div>
          ) : data?.data && data.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>上次运行</TableHead>
                    <TableHead>下次运行</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{task.name}</span>
                          {task.description && (
                            <span className="text-sm text-muted-foreground">{task.description}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            task.status === 'success' ? 'default' :
                            task.status === 'failed' ? 'destructive' :
                            task.status === 'running' ? 'outline' : 'secondary'
                          }
                        >
                          {task.status === 'idle' ? '空闲' :
                           task.status === 'running' ? '运行中' :
                           task.status === 'success' ? '成功' : '失败'}
                        </Badge>
                        {!task.enabled && (
                          <Badge variant="outline" className="ml-2">已禁用</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.last_run ? formatDateTime(task.last_run) : '未运行'}
                      </TableCell>
                      <TableCell>
                        {task.next_run ? formatDateTime(task.next_run) : '未调度'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRunTask(task.id)}
                            disabled={task.status === 'running'}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/tasks/${task.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/tasks/${task.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  您确定要删除任务 "{task.name}" 吗？此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTask(task.id)}
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-end mt-4 space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm">
                    第 {page} 页，共 {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">暂无任务</p>
              <Button asChild>
                <Link to="/tasks/new">
                  <Plus className="mr-2 h-4 w-4" /> 新建任务
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
