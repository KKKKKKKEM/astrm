import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea' // 使用 Textarea 以便输入长的 command
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { TasksApi } from '@/lib/api' // 假设 api 调用已经适配了新模型

// 新的 Zod Schema，匹配后端模型
const taskSchema = z.object({
  name: z.string().min(1, { message: '名称不能为空' }),
  description: z.string().optional(),
  concurrency: z.coerce.number().min(1).default(1),
  command: z.string().optional(),
  schedule: z.string().optional(),
  // 将 opts 定义为 key-value 对的数组，以便 useFieldArray 处理
  opts: z.array(z.object({
    key: z.string().min(1, 'Key 不能为空'),
    value: z.any(),
    type: z.enum(['string', 'number', 'boolean']).default('string'),
  })).optional(),
  enabled: z.boolean().default(true),
})

type TaskFormValues = z.infer<typeof taskSchema>


// 将后端的 map[string]any 转换为表单需要的数组格式
const transformOptsToFields = (opts: Record<string, any> | undefined | null): TaskFormValues['opts'] => {
  if (!opts) return []
  return Object.entries(opts).map(([key, value]) => {
    let type: 'string' | 'number' | 'boolean' = 'string'
    if (typeof value === 'number') type = 'number'
    else if (typeof value === 'boolean') type = 'boolean'
    return { key, value, type }
  })
}

// 将表单的数组格式转换回后端的 map[string]any
const transformFieldsToOpts = (fields: TaskFormValues['opts']): Record<string, any> => {
  if (!fields) return {}
  return fields.reduce((acc, { key, value, type }) => {
    if (key) {
      // 根据类型转换值
      if (type === 'number') {
        acc[key] = Number(value)
      } else if (type === 'boolean') {
        acc[key] = Boolean(value)
      } else {
        acc[key] = value
      }
    }
    return acc
  }, {} as Record<string, any>)
}


export function TaskForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isCreating = !id

  const { data: task, isLoading: isLoadingTask } = useQuery({
    queryKey: ['task', id],
    queryFn: () => TasksApi.getById(id!),
    enabled: !isCreating,
  })

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      description: '',
      concurrency: 1,
      command: '',
      schedule: '',
      opts: [],
      enabled: true,
    },
  })

  // 使用 useFieldArray 来管理动态的 opts 字段
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'opts',
  })

  useEffect(() => {
    if (task && !isCreating) {
      form.reset({
        ...task,
        opts: transformOptsToFields(task.opts),
      })
    }
  }, [task, isCreating, form])

  const mutation = useMutation({
    mutationFn: (data: any) => {
      return isCreating ? TasksApi.create(data) : TasksApi.update(id!, data);
    },
    onSuccess: (data) => {
      toast.success(`任务已成功${isCreating ? '创建' : '更新'}`)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task', id] })
      navigate(`/tasks/${data.id || id}`)
    },
    onError: (error) => {
      toast.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: () => TasksApi.delete(id!),
    onSuccess: () => {
      toast.success('任务已删除')
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      navigate('/tasks')
    },
    onError: (error) => {
      toast.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  })

  const onSubmit = (values: TaskFormValues) => {
    // 转换 opts 格式
    const payload = {
      ...values,
      opts: transformFieldsToOpts(values.opts),
    }
    mutation.mutate(payload)
  }

  const handleDelete = () => {
    if (confirm('确定要删除此任务吗？此操作不可撤销。')) {
      deleteMutation.mutate()
    }
  }

  // 动态渲染不同类型的输入控件
  const renderValueInput = (index: number) => {
    const type = form.watch(`opts.${index}.type`)
    switch (type) {
      case 'number':
        return (
            <Controller
                control={form.control}
                name={`opts.${index}.value`}
                defaultValue={0}
                render={({ field }) => <Input type="number" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />}
            />
        )
      case 'boolean':
        return (
            <Controller
                control={form.control}
                name={`opts.${index}.value`}
                defaultValue={false}
                render={({ field }) => (
                    <div className="flex items-center h-10">
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                )}
            />
        )
      case 'string':
      default:
        return (
            <Controller
                control={form.control}
                name={`opts.${index}.value`}
                defaultValue=""
                render={({ field }) => <Input {...field} placeholder="值" />}
            />
        )
    }
  }

  if (isLoadingTask && !isCreating) {
    return <div className="flex justify-center p-4">加载任务数据...</div>
  }

  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">{isCreating ? '创建新任务' : '编辑任务'}</h2>
          </div>
          {!isCreating && (
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? '删除中...' : '删除任务'}
              </Button>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>任务名称</FormLabel>
                      <FormControl><Input {...field} placeholder="例如: 同步电影" /></FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述</FormLabel>
                      <FormControl><Textarea {...field} placeholder="任务的详细描述" /></FormControl>
                      <FormMessage />
                    </FormItem>
                )}/>
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="concurrency" render={({ field }) => (
                      <FormItem>
                        <FormLabel>并发数</FormLabel>
                        <FormControl><Input type="number" {...field} min="1" /></FormControl>
                        <FormMessage />
                      </FormItem>
                  )}/>
                  <FormField control={form.control} name="schedule" render={({ field }) => (
                      <FormItem>
                        <FormLabel>计划 (Cron 表达式)</FormLabel>
                        <FormControl><Input {...field} placeholder="例如: 0 2 * * *" /></FormControl>
                        <FormDescription>留空则为手动执行。例如 "0 2 * * *" 代表每天凌晨2点执行。</FormDescription>
                        <FormMessage />
                      </FormItem>
                  )}/>
                </div>
                <FormField control={form.control} name="command" render={({ field }) => (
                    <FormItem>
                      <FormLabel>执行命令</FormLabel>
                      <FormControl><Textarea {...field} placeholder="执行的具体命令或脚本内容" rows={5} className="font-mono" /></FormControl>
                      <FormDescription>要执行的Shell命令或脚本。可以通过 {'{{ .opt_key }}'} 的形式引用下面的选项。</FormDescription>
                      <FormMessage />
                    </FormItem>
                )}/>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>动态选项 (Opts)</CardTitle>
                <CardDescription>在这里添加任务所需的额外参数。这些参数可以在“执行命令”中通过 {`{{.key_name}}`} 的形式引用。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
                        <FormField control={form.control} name={`opts.${index}.key`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>键 (Key)</FormLabel>
                              <FormControl><Input {...field} placeholder="例如: source_path" /></FormControl>
                              <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name={`opts.${index}.type`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>类型</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="string">文本 (string)</SelectItem>
                                  <SelectItem value="number">数字 (number)</SelectItem>
                                  <SelectItem value="boolean">布尔 (boolean)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                        )}/>
                        <FormItem>
                          <FormLabel>值 (Value)</FormLabel>
                          <FormControl>{renderValueInput(index)}</FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="mt-8" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" onClick={() => append({ key: '', value: '', type: 'string' })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> 添加选项
                </Button>
              </CardContent>
            </Card>

            <FormField control={form.control} name="enabled" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 rounded-lg border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-base">启用任务</FormLabel>
                    <FormDescription>仅当启用时，计划任务才会自动执行。</FormDescription>
                  </div>
                </FormItem>
            )}/>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={mutation.isPending}>取消</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? '保存中...' : (isCreating ? '创建任务' : '保存更改')}
              </Button>
            </div>
          </form>
        </Form>
      </div>
  )
}
