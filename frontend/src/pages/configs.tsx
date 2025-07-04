import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface Config {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
}

export function Configs() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/configs?search=${search}`);
      if (!response.ok) throw new Error('获取配置失败');
      const data = await response.json();
      setConfigs(data.data || []);
    } catch (error) {
      console.error('获取配置失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '获取配置列表失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentStatus }),
      });

      if (!response.ok) throw new Error('更新状态失败');

      setConfigs(configs.map(config => 
        config.id === id ? { ...config, enabled: !currentStatus } : config
      ));

      toast({
        title: '成功',
        description: `配置已${!currentStatus ? '启用' : '禁用'}`,
      });
    } catch (error) {
      console.error('更新状态失败:', error);
      toast({
        variant: 'destructive',
        title: '错误',
        description: '更新配置状态失败',
      });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchConfigs();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">配置管理</h1>
        <Button asChild>
          <Link to="/configs/new">添加配置</Link>
        </Button>
      </div>

      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="搜索配置名称或描述"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Button type="submit">搜索</Button>
        </form>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  加载中...
                </TableCell>
              </TableRow>
            ) : configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  暂无配置数据
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.name}</TableCell>
                  <TableCell>{config.description}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => handleToggleStatus(config.id, config.enabled)}
                      />
                      <span>{config.enabled ? '已启用' : '已禁用'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(config.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/configs/${config.id}`}>查看</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
