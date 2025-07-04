import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ListTodo,
  Settings,
  ClipboardList,
  ArrowRightLeft,
} from 'lucide-react'

const navItems = [
  {
    title: '仪表盘',
    href: '/',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: '任务管理',
    href: '/tasks',
    icon: ListTodo,
  },
  {
    title: '配置管理',
    href: '/configs',
    icon: Settings,
  },
  {
    title: '日志管理',
    href: '/logs',
    icon: ClipboardList,
  },
  {
    title: '反向代理',
    href: '/proxies',
    icon: ArrowRightLeft,
  },
]

export function Sidebar() {
  return (
    <div className="w-64 border-r bg-background h-[calc(100vh-4rem)] shrink-0">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.exact}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
