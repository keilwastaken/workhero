export interface Bird {
  id: string;
  name: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}
