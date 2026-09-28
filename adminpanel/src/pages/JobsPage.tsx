import { useEffect, useState } from 'react';
import { Table, Tag, Button, Drawer } from 'antd';
import dayjs from 'dayjs';
import { fetchJobs } from '../api/admin';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [viewingResult, setViewingResult] = useState<any | null>(null);

  const loadData = (page = 1, limit = 20) => {
    setLoading(true);
    fetchJobs(page, limit)
      .then(res => {
        setJobs(res.data);
        setPagination({ current: res.page, pageSize: res.limit, total: res.total });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleTableChange = (pag: any) => {
    loadData(pag.current, pag.pageSize);
  };

  const columns = [
    { title: 'Job ID', dataIndex: 'id', key: 'id' },
    { title: 'User ID', dataIndex: 'userId', key: 'userId' },
    { title: 'App', dataIndex: 'walletApp', key: 'walletApp' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = { 
          processed: 'success', 
          failed: 'error', 
          processing: 'processing',
          pending: 'default'
        };
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
      }
    },
    { title: 'Type', dataIndex: 'txType', key: 'txType' },
    { 
      title: 'Created At', 
      dataIndex: 'createdAt', 
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button size="small" type="link" onClick={() => setViewingResult(record)}>View Details</Button>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>OCR Jobs</h2>
      <Table 
        columns={columns} 
        dataSource={jobs} 
        rowKey="id" 
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      <Drawer
        title={`Job Details: ${viewingResult?.id}`}
        placement="right"
        width={600}
        onClose={() => setViewingResult(null)}
        open={!!viewingResult}
      >
        {viewingResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Uploaded Image</h3>
              {viewingResult.imagePath ? (
                <img 
                  src={`http://localhost:3000/${viewingResult.imagePath}`} 
                  alt="Receipt" 
                  style={{ width: '100%', maxWidth: 400, borderRadius: 8, border: '1px solid #d9d9d9' }} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x600?text=Image+Not+Found';
                  }}
                />
              ) : (
                <p>No image attached to this job.</p>
              )}
            </div>
            
            <div>
              <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Result Payload (JSON)</h3>
              <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13 }}>
                {JSON.stringify(viewingResult.resultJson, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
