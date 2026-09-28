import { ConfigProvider } from 'antd';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import RecordsPage from './pages/RecordsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

// Brand theme tokens — teal palette matching the screenshot
const theme = {
  token: {
    colorPrimary: '#0D7B8C',
    colorLink: '#0D7B8C',
    borderRadius: 12,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
};

export default function App() {
  const token = localStorage.getItem('token');

  if (!token) {
    return (
      <ConfigProvider theme={theme}>
        <LoginPage />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={theme}>
      <BrowserRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ConfigProvider>
  );
}
