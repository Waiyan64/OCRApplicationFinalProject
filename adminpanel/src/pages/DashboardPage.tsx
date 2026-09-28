import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin, Alert } from 'antd';
import { fetchStats, type AdminStats } from '../api/admin';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" />;
  if (error) return <Alert type="error" message={error} />;
  if (!stats) return null;

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontWeight: 600 }}>System Overview</h2>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Statistic title="Total Users" value={stats.totalUsers} valueStyle={{ color: '#0D7B8C' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Statistic title="Total OCR Jobs" value={stats.totalJobs} valueStyle={{ color: '#0D7B8C' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Statistic title="Job Success Rate" value={stats.successRate} precision={2} suffix="%" valueStyle={{ color: stats.successRate > 80 ? '#3f8600' : '#cf1322' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Statistic title="Successful Jobs" value={stats.successfulJobs} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Statistic title="Failed Jobs" value={stats.failedJobs} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Statistic title="Total Transaction Volume (Ks)" value={stats.totalVolume} />
          </Card>
        </Col>
      </Row>

      <Row style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="OCR Jobs (Last 7 Days)" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="jobs" fill="#0D7B8C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
