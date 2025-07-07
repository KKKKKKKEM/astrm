import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { XIcon, PlusIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';

// 用于验证插件配置是否为有效的 JSON
const jsonString = z.string().transform((val, ctx) => {
  if (val.trim() === '') return '{}'; // 允许空字符串，并视其为有效的空JSON对象
  try {
    JSON.parse(val);
    return val;
  } catch (e) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '必须是有效的 JSON 格式' });
    return z.NEVER;
  }
});

const pluginSchema = z.object({
  ID: z.number().optional(),
  name: z.string().min(1, '请选择一个插件'),
  regex: z.string().min(1, '触发规则 (正则表达式) 不能为空'),
  config: jsonString.default('{}'),
});

const proxySchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  path: z.string().min(1, '路径不能为空').startsWith('/', '路径必须以 / 开头'),
  target_url: z.string().url('请输入有效的URL').min(1, '目标URL不能为空'),
  strip_prefix: z.boolean().default(false),
  enabled: z.boolean().default(true),
  plugins: z.array(pluginSchema).optional(),
});

type ProxyFormValues = z.infer<typeof proxySchema>;

export function ProxyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // **错误修正**: 添加了 `availablePlugins` 的 state 定义
  const [availablePlugins, setAvailablePlugins] = useState<string[]>([]);

  const isNew = id === 'new';

  const form = useForm<ProxyFormValues>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      name: '',
      path: '/',
      target_url: 'http://',
      strip_prefix: false,
      enabled: true,
      plugins: [], // 初始化插件数组
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'plugins',
  });

  useEffect(() => {
    const fetchAvailablePlugins = async () => {
      try {
        const response = await fetch('/api/proxies/plugins/available');
        if (!response.ok) throw new Error('获取可用插件列表失败');
        const data = await response.json();
        setAvailablePlugins(data || []);
      } catch (error) {
        console.error('获取插件列表失败:', error);
        toast({ variant: 'destructive', title: '错误', description: (error as Error).message });
      }
    };

    const fetchProxy = async () => {
      if (isNew) return; // 如果是新建页面，则不执行获取操作
      try {
        setLoading(true);
        const response = await fetch(`/api/proxies/${id}`);
        if (!response.ok) throw new Error('获取代理详情失败');
        const data = await response.json();
        form.reset({
          ...data,
          plugins: data.plugins || [], // 确保 plugins 字段始终是数组
        });
      } catch (error) {
        console.error('获取代理详情失败:', error);
        toast({ variant: 'destructive', title: '错误', description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };

    fetchAvailablePlugins();
    fetchProxy();
  }, [id, isNew, form, toast]);


  const onSubmit = async (values: ProxyFormValues) => {
    setLoading(true);
    try {
      const url = isNew ? '/api/proxies' : `/api/proxies/${id}`;
      const method = isNew ? 'POST' : 'PUT';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || '保存代理失败');
      }

      toast({ title: '成功', description: `代理已${isNew ? '创建' : '更新'}` });

      form.reset(responseData);
      if (isNew) {
        navigate(`/proxies/${responseData.id}`, { replace: true });
      }
    } catch (error) {
      console.error('保存代理失败:', error);
      toast({ variant: 'destructive', title: '错误', description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('确定要删除此代理吗？此操作不可逆！')) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/proxies/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('删除代理失败');
      toast({ title: '成功', description: '代理已删除' });
      navigate('/proxies');
    } catch (error) {
      console.error('删除代理失败:', error);
      toast({ variant: 'destructive', title: '错误', description: (error as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{isNew ? '创建新代理' : '编辑代理'}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/proxies')}>返回</Button>
            {!isNew && (
                <>
                  <Button asChild className={!form.watch('enabled') ? "opacity-50 cursor-not-allowed" : ""}>
                    <a href={form.watch('enabled') ? form.getValues().path : undefined} target="_blank" rel="noopener noreferrer">
                      访问代理 ↗
                    </a>
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? '删除中...' : '删除'}</Button>
                </>
            )}
          </div>
        </div>

        {loading && !isNew ? (
            <div className="flex justify-center py-10">加载代理配置中...</div>
        ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle>基础配置</CardTitle>
                    <CardDescription>代理服务器的核心转发规则</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    {/* **错误修正**: 填充了所有基础表单字段的实现 */}
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>名称</FormLabel>
                          <FormControl><Input placeholder="我的API代理" {...field} /></FormControl>
                          <FormDescription>用于标识此代理的名称。</FormDescription>
                          <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="path" render={({ field }) => (
                        <FormItem>
                          <FormLabel>代理路径</FormLabel>
                          <FormControl><Input placeholder="/v1/api" {...field} /></FormControl>
                          <FormDescription>此网关对外暴露的路径前缀。</FormDescription>
                          <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="target_url" render={({ field }) => (
                        <FormItem>
                          <FormLabel>目标URL</FormLabel>
                          <FormControl><Input placeholder="http://backend-service:8000" {...field} /></FormControl>
                          <FormDescription>请求将被转发到的内部服务地址。</FormDescription>
                          <FormMessage />
                        </FormItem>
                    )}/>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="strip_prefix" render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 rounded-lg border p-4 h-full">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>去除路径前缀</FormLabel>
                              <FormDescription>转发时从URL中移除代理路径。</FormDescription>
                            </div>
                          </FormItem>
                      )}/>
                      <FormField control={form.control} name="enabled" render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 rounded-lg border p-4 h-full">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>启用代理</FormLabel>
                              <FormDescription>是否激活此条代理规则。</FormDescription>
                            </div>
                          </FormItem>
                      )}/>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>插件管理</CardTitle>
                    <CardDescription>为代理挂载插件以实现高级功能。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无插件</p>}
                    {fields.map((item, index) => (
                        <div key={item.id} className="border rounded-lg p-4 space-y-4 relative">
                          <Button variant="ghost" size="icon" type="button" onClick={() => remove(index)} className="absolute top-2 right-2 h-6 w-6">
                            <XIcon className="h-4 w-4" />
                          </Button>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`plugins.${index}.name`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel>插件名称</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="请选择一个插件" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {availablePlugins.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name={`plugins.${index}.regex`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel>触发规则 (Regex)</FormLabel>
                                  <FormControl><Input placeholder="例如: /users/.*" {...field} /></FormControl>
                                  <FormDescription>请求URL匹配此正则时生效。</FormDescription>
                                  <FormMessage />
                                </FormItem>
                            )}/>
                          </div>
                          <FormField control={form.control} name={`plugins.${index}.config`} render={({ field }) => (
                              <FormItem>
                                <FormLabel>插件配置 (JSON)</FormLabel>
                                <FormControl><Textarea placeholder='例如: {"key": "value"}' className="font-mono min-h-[80px]" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                          )}/>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => append({ name: '', regex: '.*', config: '{}' })} className="w-full">
                      <PlusIcon className="mr-2 h-4 w-4" /> 添加插件
                    </Button>
                  </CardContent>
                </Card>

                <Button type="submit" disabled={loading}>{loading ? '保存中...' : '保存代理'}</Button>
              </form>
            </Form>
        )}
      </div>
  );
}
