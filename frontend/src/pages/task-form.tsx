import  { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const taskSchema = z.object({
  name: z.string().min(1, { message: '名称不能为空' }),
  alist: z.coerce.number().default(0),
  concurrency: z.coerce.number().min(1).default(1),
  from: z.string().min(1, { message: '源路径不能为空' }),
  dest: z.string().min(1, { message: '目标路径不能为空' }),
  mode: z.string().default('alist_url'),
  spec: z.string().optional(),
  opts: z.object({
    deep: z.coerce.number().min(1).default(1),
    overwrite: z.boolean().default(true),
    filters: z.string().optional(),
    extra: z.string().optional(),
    refresh: z.boolean().default(true),
    interval: z.coerce.number().min(1).default(1),
  }),
  schedule: z.string().optional(),
  enabled: z.boolean().default(true),
})

type TaskFormValues = z.infer<typeof taskSchema>

export function TaskForm() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 通过检查URL路径判断是否是新建任务
  const isCreating = location.pathname.includes('/tasks/new')

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      alist: 0,
      concurrency: 1,
      from: '',
      dest: '',
      mode: 'alist_url',
      spec: '',
      opts: {
        deep: 1,
        overwrite: true,
        filters: '(?i)^\\.(mp4|avi|mkv|mov|webm|flv|wmv|3gp|mpeg|mpg|ts|rmvb)$',
        extra: '(?i)^\\.(nfo|ass|srt|ssa|sub|png|jpg)$',
        refresh: true,
        interval: 1,
      },
      schedule: '',
      enabled: true,
    },
  })

  useEffect(() => {
    if (!isCreating && params.id) {
      fetchTask(params.id)
    }
  }, [params.id, isCreating])

  const fetchTask = async (taskId: string) => {
    try {
      setLoading(true)
      console.log(`获取任务 ${taskId} 详情`)
      const response = await fetch(`/api/tasks/${taskId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取任务失败')
      }

      const data = await response.json()
      console.log('获取到任务数据:', data)

      form.reset(data)
    } catch (error) {
      console.error('获取任务失败:', error)
      toast(`获取任务详情失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (values: TaskFormValues) => {
    try {
      setLoading(true)
      console.log('提交表单数据:', values)

      let url, method, successMessage

      if (isCreating) {
        // 新建任务
        url = '/api/tasks'
        method = 'POST'
        successMessage = '任务已创建'
      } else if (params.id) {
        // 更新任务
        url = `/api/tasks/${params.id}`
        method = 'PUT'
        successMessage = '任务已更新'
      } else {
        throw new Error('无效的操作')
      }

      console.log(`发送 ${method} 请求到 ${url}`)
      // 深拷贝表单值并确保所有结构正确
      const payload = JSON.parse(JSON.stringify(values))

      // 确保 opts 字段正确初始化
      if (!payload.opts) {
        payload.opts = {
          deep: 1,
          overwrite: true,
          refresh: true,
          interval: 1
        }
      }

      console.log('发送数据:', payload)
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '保存任务失败')
      }

      const responseData = await response.json()
      console.log('保存任务成功:', responseData)

      toast(successMessage)

      // 如果是创建操作，使用返回的ID导航
      if (isCreating && responseData.id) {
        console.log('新任务创建成功，ID:', responseData.id)
        navigate(`/tasks/${responseData.id}`)
      } else if (params.id) {
        // 如果是更新操作，使用当前ID导航
        console.log('任务更新成功，ID:', params.id)
        navigate(`/tasks/${params.id}`)
      } else {
        // 如果出现意外情况，返回任务列表
        navigate('/tasks')
      }
    } catch (error) {
      console.error('保存任务失败:', error)
      toast(`${isCreating ? '创建' : '更新'}任务失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!params.id || isCreating) return
    if (!confirm('确定要删除此任务吗？')) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/tasks/${params.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除任务失败')
      }

      toast('任务已删除')
      navigate('/tasks')
    } catch (error) {
      console.error('删除任务失败:', error)
      toast(`删除任务失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">
            {isCreating ? '创建新任务' : '编辑任务'}
          </h2>
        </div>

        {!isCreating && params.id && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || loading}
            >
              {deleting ? '删除中...' : '删除任务'}
            </Button>
          </div>
        )}
      </div>

      {loading && !isCreating && params.id ? (
        <div className="flex justify-center py-10">加载中...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>任务信息</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任务名称</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如: 同步电影" />
                    </FormControl>
                    <FormDescription>给这个任务一个描述性的名称</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="alist"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ALIST ID</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>ALIST 服务器 ID</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="concurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>并发数</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min="1" />
                      </FormControl>
                      <FormDescription>同时处理的文件数</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>源路径</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="aliyun/媒体库/电影
aliyun/媒体库/动漫"
                        rows={4}
                      />
                    </FormControl>
                    <FormDescription>源路径，每行一个路径</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目标路径</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="/data/media/电影" />
                    </FormControl>
                    <FormDescription>下载目标路径</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模式</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="alist_url" />
                    </FormControl>
                    <FormDescription>下载模式，通常使用 alist_url</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>计划（Cron 表达式）</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="0 0 * * *" />
                    </FormControl>
                    <FormDescription>任务执行计划，留空为手动执行</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Card>
                <CardHeader>
                  <CardTitle>高级选项</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="opts.deep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>递归深度</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} min="1" />
                          </FormControl>
                          <FormDescription>递归处理的目录深度</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="opts.interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>刷新间隔</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} min="1" />
                          </FormControl>
                          <FormDescription>刷新间隔，单位为秒</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="opts.filters"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>文件过滤器</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(?i)^\.(mp4|mkv|avi)$" />
                        </FormControl>
                        <FormDescription>正则表达式，用于匹配要下载的文件</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="opts.extra"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>额外文件</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(?i)^\.(srt|ass|jpg)$" />
                        </FormControl>
                        <FormDescription>正则表达式，用于匹配额外下载的文件</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="opts.overwrite"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 rounded-lg border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-base">
                              覆盖已存在文件
                            </FormLabel>
                            <FormDescription>
                              如果目标文件已存在，是否覆盖
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="opts.refresh"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 rounded-lg border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-base">
                              启用刷新
                            </FormLabel>
                            <FormDescription>
                              启用刷新以持续监控源目录变化
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 rounded-lg border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-base">
                        启用任务
                      </FormLabel>
                      <FormDescription>
                        是否启用此任务的自动执行
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/tasks')}
                  disabled={loading}
                >
                  取消
                </Button>
                {!isCreating && params.id && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate(`/tasks/${params.id}/run`)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    运行
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? '保存中...' : (isCreating ? '创建任务' : '保存更改')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
