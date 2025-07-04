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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const configSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  configData: z.string().min(1, '配置内容不能为空'),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export function ConfigDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isNew = id === 'new';

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      name: '',
      description: '',
      enabled: true,
      configData: '',
    },
  });

  useEffect(() => {
    if (!isNew) {
      fetchConfig();
    }
  }, [id]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/configs/${id}`);
      if (!response.ok) throw new Error('获取配置失败');
      const data = await response.json();

      form.reset({
        name: data.name,
        description: data.description || '',
        enabled: data.enabled,
        configData: data.configData,
      });
    } catch (error) {
      console.error('获取配置失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '获取配置详情失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: ConfigFormValues) => {
    try {
      setLoading(true);
      const url = isNew ? '/api/configs' : `/api/configs/${id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) throw new Error('保存配置失败');

      toast({
        title: '成功',
        description: `配置已${isNew ? '创建' : '更新'}`,
      });

      if (isNew) {
        const data = await response.json();
        navigate(`/configs/${data.id}`);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: `${isNew ? '创建' : '更新'}配置失败`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除此配置吗？')) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/configs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除配置失败');

      toast({
        title: '成功',
        description: '配置已删除',
      });

      navigate('/configs');
    } catch (error) {
      console.error('删除配置失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '删除配置失败',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {isNew ? '创建配置' : '编辑配置'}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/configs')}>
            返回
          </Button>
          {!isNew && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '删除中...' : '删除'}
            </Button>
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
                      <Input placeholder="输入配置名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea placeholder="输入配置描述（可选）" {...field} />
                    </FormControl>
                    <FormDescription>
                      简要描述此配置的用途
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        启用状态
                      </FormLabel>
                      <FormDescription>
                        设置此配置是否启用
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="configData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>配置内容</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="输入配置内容，支持JSON或其他格式" 
                        className="font-mono h-64"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存配置'}
              </Button>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
