import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const proxySchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  path: z.string().min(1, '路径不能为空'),
  target_url: z.string().url('请输入有效的URL').min(1, '目标URL不能为空'),
  strip_prefix: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

type ProxyFormValues = z.infer<typeof proxySchema>;

export function ProxyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isNew = id === 'new';

  const form = useForm<ProxyFormValues>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      name: '',
      path: '/',
      target_url: 'http://',
      strip_prefix: false,
      enabled: true,
    },
  });

  useEffect(() => {
    if (!isNew) {
      fetchProxy();
    }
  }, [id]);

  const fetchProxy = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxies/${id}`);
      if (!response.ok) throw new Error('获取代理失败');
      const data = await response.json();

      form.reset({
        name: data.name,
        path: data.path,
        target_url: data.target_url,
        strip_prefix: data.strip_prefix,
        enabled: data.enabled,
      });
    } catch (error) {
      console.error('获取代理失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '获取代理详情失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: ProxyFormValues) => {
    try {
      setLoading(true);
      const url = isNew ? '/api/proxies' : `/api/proxies/${id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存代理失败');
      }

      toast({
        title: '成功',
        description: `代理已${isNew ? '创建' : '更新'}`,
      });

      if (isNew) {
        const data = await response.json();
        navigate(`/proxies/${data.id}`);
      }
    } catch (error) {
      console.error('保存代理失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: error instanceof Error ? error.message : `${isNew ? '创建' : '更新'}代理失败`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除此代理吗？')) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/proxies/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除代理失败');

      toast({
        title: '成功',
        description: '代理已删除',
      });

      navigate('/proxies');
    } catch (error) {
      console.error('删除代理失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '删除代理失败',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {isNew ? '创建代理' : '编辑代理'}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/proxies')}>
            返回
          </Button>
          {!isNew && (
            <>
              <Button 
                variant="default" 
                asChild
                className={!form.getValues().enabled ? "opacity-50 cursor-not-allowed" : ""}
                onClick={(e) => {
                  if (!form.getValues().enabled) {
                    e.preventDefault();
                    toast({
                      title: "提示",
                      description: "代理未启用，请先启用后再访问",
                    });
                    return false;
                  }
                }}
              >
                <a 
                  href={form.getValues().path} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={!form.getValues().enabled ? "pointer-events-none" : ""}
                >
                  <span className="flex items-center">访问代理 ↗</span>
                </a>
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? '删除中...' : '删除'}
              </Button>
            </>
          )}
        </div>
      </div>

      {loading && !isNew ? (
        <div className="flex justify-center py-10">加载中...</div>
      ) : (
        <div className="border rounded-md p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder="输入代理名称" {...field} />
                    </FormControl>
                    <FormDescription>
                      用于标识此代理的名称
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>路径</FormLabel>
                    <FormControl>
                      <Input placeholder="/api/external" {...field} />
                    </FormControl>
                    <FormDescription>
                      代理的路径前缀，必须以 / 开头
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目标URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://api.example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      请求将被转发到的目标URL
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="strip_prefix"
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
                          去除路径前缀
                        </FormLabel>
                        <FormDescription>
                          转发请求时去除路径前缀
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

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
                          <span className={`flex items-center ${field.value ? 'text-green-600' : 'text-gray-500'}`}>
                            <div className={`w-3 h-3 rounded-full ${field.value ? 'bg-green-500' : 'bg-gray-400'} mr-2`}></div>
                            {field.value ? '已启用' : '已禁用'}
                          </span>
                        </FormLabel>
                        <FormDescription>
                          设置此代理是否启用
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存代理'}
              </Button>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
