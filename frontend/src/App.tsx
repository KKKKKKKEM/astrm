import { Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Layout } from '@/components/layout'
import { Dashboard } from '@/pages/dashboard'
import { Tasks } from '@/pages/tasks'
import { TaskDetail } from '@/pages/task-detail'
import { TaskForm } from '@/pages/task-form'
import { Configs } from '@/pages/configs'
import { ConfigDetail } from '@/pages/config-detail'
import { Logs } from '@/pages/logs'
import { LogDetail } from '@/pages/log-detail'
import { Proxies } from '@/pages/proxies'
import { ProxyDetail } from '@/pages/proxy-detail'
import { NotFound } from '@/pages/not-found'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks">
            <Route index element={<Tasks />} />
            <Route path="new" element={<TaskForm />} />
            <Route path=":id" element={<TaskDetail />} />
            <Route path=":id/edit" element={<TaskForm />} />
          </Route>
          <Route path="configs">
            <Route index element={<Configs />} />
            <Route path=":id" element={<ConfigDetail />} />
          </Route>
          <Route path="logs">
            <Route index element={<Logs />} />
            <Route path=":id" element={<LogDetail />} />
          </Route>
          <Route path="proxies">
            <Route index element={<Proxies />} />
            <Route path=":id" element={<ProxyDetail />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}

export default App
