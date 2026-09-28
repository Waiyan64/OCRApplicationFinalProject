import { Layout, Menu, Avatar, Dropdown, Space } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  FileSearchOutlined,
  DollarOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import JobsPage from './pages/JobsPage';
import TransactionsPage from './pages/TransactionsPage';

const { Header, Sider, Content } = Layout;

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/users', icon: <UserOutlined />, label: 'Users' },
    { key: '/jobs', icon: <FileSearchOutlined />, label: 'OCR Jobs' },
    { key: '/transactions', icon: <DollarOutlined />, label: 'Transactions' },
  ];

  const userMenu = {
    items: [
      { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout' },
    ]
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible theme="light">
        <div style={{ height: 32, margin: 16, background: 'rgba(13, 123, 140, 0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#0D7B8C' }}>
          OCR Admin
        </div>
        <Menu
          theme="light"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#0D7B8C' }}>A</Avatar>
              <span style={{ fontWeight: 500 }}>Admin</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, minHeight: 360, background: '#fff', borderRadius: 8 }}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
