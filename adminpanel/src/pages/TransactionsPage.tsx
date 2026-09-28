import { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { fetchTransactions } from '../api/admin';

export default function TransactionsPage() {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const loadData = (page = 1, limit = 20) => {
    setLoading(true);
    fetchTransactions(page, limit)
      .then(res => {
        setTxs(res.data);
        setPagination({ current: res.page, pageSize: res.limit, total: res.total });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleTableChange = (pag: any) => {
    loadData(pag.current, pag.pageSize);
  };

  const columns = [
    { title: 'TX ID', dataIndex: 'id', key: 'id', render: (id: string) => id.slice(0, 8) + '...' },
    { title: 'User ID', dataIndex: 'userId', key: 'userId' },
    { title: 'App', dataIndex: 'walletApp', key: 'walletApp' },
    { 
      title: 'Type', 
      dataIndex: 'type', 
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'cash_in' ? 'blue' : 'orange'}>
          {type === 'cash_in' ? 'CASH IN' : 'CASH OUT'}
        </Tag>
      )
    },
    { 
      title: 'Amount (Ks)', 
      dataIndex: 'amount', 
      key: 'amount',
      render: (amount: number) => <span style={{ fontWeight: 600 }}>{amount.toLocaleString()}</span>
    },
    { 
      title: 'Fee', 
      dataIndex: 'fee', 
      key: 'fee',
      render: (fee: number) => fee.toLocaleString()
    },
    { 
      title: 'Timestamp', 
      dataIndex: 'txTimestamp', 
      key: 'txTimestamp',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontWeight: 600 }}>Global Transactions Audit</h2>
      <Table 
        columns={columns} 
        dataSource={txs} 
        rowKey="id" 
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />
    </div>
  );
}
