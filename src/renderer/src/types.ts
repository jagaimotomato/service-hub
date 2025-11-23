export interface Service {
  id: string
  name: string
  cwd: string
  command: string
  status: 'stopped' | 'running' | 'error'
}
