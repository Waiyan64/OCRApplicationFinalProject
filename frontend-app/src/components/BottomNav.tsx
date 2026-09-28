import { NavLink } from 'react-router-dom';
import {
  HomeOutlined,
  HomeFilled,
  EditOutlined,
  EditFilled,
  FileTextOutlined,
  FileTextFilled,
  SettingOutlined,
  SettingFilled,
} from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

const DARK_TEAL = '#065A6B';
const GREY = '#4F4F4F';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Home',
    ActiveIcon: HomeFilled,
    InactiveIcon: HomeOutlined,
  },
  {
    to: '/upload',
    label: 'Upload',
    ActiveIcon: EditFilled,
    InactiveIcon: EditOutlined,
  },
  {
    to: '/records',
    label: 'Records',
    ActiveIcon: FileTextFilled,
    InactiveIcon: FileTextOutlined,
  },
  {
    to: '/settings',
    label: 'Settings',
    ActiveIcon: SettingFilled,
    InactiveIcon: SettingOutlined,
  },
] as const;

export default function BottomNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        backgroundColor: '#fff',
        display: 'flex',
        zIndex: 100,
        boxShadow: '0 0 20px rgba(0,0,0,0.1)',
        borderRadius: '20px 20px 0 0',
        padding: '13px 15px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {NAV_ITEMS.map(({ to, label, ActiveIcon, InactiveIcon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          style={{ flex: 1, textDecoration: 'none' }}
        >
          {({ isActive }) => (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {isActive ? (
                <ActiveIcon style={{ fontSize: 22, color: DARK_TEAL }} />
              ) : (
                <InactiveIcon style={{ fontSize: 22, color: GREY }} />
              )}
              <Text
                style={{
                  fontSize: 10,
                  color: isActive ? DARK_TEAL : GREY,
                  fontWeight: isActive ? 700 : 400,
                  fontFamily: 'Noto Sans Myanmar',
                  lineHeight: 1,
                  textAlign: 'center',
                }}
              >
                {label}
              </Text>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
