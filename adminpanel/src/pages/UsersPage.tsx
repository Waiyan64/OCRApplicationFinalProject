import { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Form, Select, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { fetchUsers, updateUser, type UserRow } from '../api/admin';

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form] = Form.useForm();

  const loadData = (page = 1, limit = 20) => {
    setLoading(true);
    fetchUsers(page, limit)
      .then(res => {
        setUsers(res.data);
        setPagination({ current: res.page, pageSize: res.limit, total: res.total });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleTableChange = (pag: any) => {
    loadData(pag.current, pag.pageSize);
  };

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    form.setFieldsValue({
      role: user.role,
      premiumExpiresAt: user.premiumExpiresAt ? dayjs(user.premiumExpiresAt) : null,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!editingUser) return;
      
      const payload = {
        role: values.role,
        premiumExpiresAt: values.premiumExpiresAt ? values.premiumExpiresAt.toISOString() : null,
      };

      await updateUser(editingUser.id, payload);
      message.success('User updated successfully');
      setEditingUser(null);
      loadData(pagination.current, pagination.pageSize);
    } catch (e: any) {
      message.error(e.message || 'Validation failed');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { 
      title: 'Role', 
      dataIndex: 'role', 
      key: 'role',
      render: (role: string) => {
        const colors: Record<string, string> = { admin: 'red', subscribed: 'green', free: 'default' };
        return <Tag color={colors[role]}>{role.toUpperCase()}</Tag>;
      }
    },
    { 
      title: 'Premium Expires', 
      dataIndex: 'premiumExpiresAt', 
      key: 'premiumExpiresAt',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    { 
      title: 'Joined', 
      dataIndex: 'createdAt', 
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    { 
      title: 'Jobs', 
      dataIndex: 'jobsCount', 
      key: 'jobsCount'
    },
    { 
      title: 'TXs', 
      dataIndex: 'txCount', 
      key: 'txCount'
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: UserRow) => (
        <Button size="small" type="primary" style={{ background: '#0D7B8C' }} onClick={() => handleEdit(record)}>Manage</Button>
      ),
    },
  ];

  const add30Days = () => {
    form.setFieldsValue({
      premiumExpiresAt: dayjs().add(30, 'day')
    });
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontWeight: 600 }}>User Management</h2>
      <Table 
        columns={columns} 
        dataSource={users} 
        rowKey="id" 
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      <Modal
        title={`Edit User: ${editingUser?.name}`}
        open={!!editingUser}
        onOk={handleSave}
        onCancel={() => setEditingUser(null)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="free">Free</Select.Option>
              <Select.Option value="subscribed">Subscribed</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="premiumExpiresAt" label="Premium Expiration">
            <div style={{ display: 'flex', gap: 8 }}>
              <DatePicker style={{ flex: 1 }} />
              <Button onClick={add30Days}>+ 30 Days</Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
