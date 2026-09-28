import { useState } from 'react';
import { Card, Row, Col, Typography, Button, Skeleton, Divider } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import type { Summary } from '../api/dashboard';

const { Text, Link } = Typography;

const DARK_TEAL = '#065A6B';

function fmt(n: number): string {
  return n.toLocaleString();
}

interface SummaryCardProps {
  summary: Summary;
  loading?: boolean;
}

export default function SummaryCard({ summary, loading }: SummaryCardProps) {
  const [visible, setVisible] = useState(false);

  const masked = '* * * * * *  ' + summary.currency;
  const cashInDisplay  = visible ? `${fmt(summary.cashIn)} ${summary.currency}`  : masked;
  const cashOutDisplay = visible ? `${fmt(summary.cashOut)} ${summary.currency}` : masked;

  return (
    <Card
      bordered={false}
      style={{ borderRadius: 15, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
      styles={{ body: { padding: '20px' } }}
    >
      {/* Card header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Text strong style={{ color: DARK_TEAL, fontSize: 13, fontFamily: 'Noto Sans Myanmar', fontWeight: 500 }}>
          Total Balance
        </Text>
        <Link href="/records" style={{ color: DARK_TEAL, fontSize: 11, fontFamily: 'Noto Sans Myanmar', fontWeight: 700, textDecoration: 'underline' }}>
          View Details
        </Link>
      </Row>

      <Divider style={{ margin: '0 0 16px 0', borderColor: 'rgba(8, 96, 125, 0.24)' }} />

      {/* Two columns */}
      <Row align="middle">
        {/* Cash In column */}
        <Col flex="1">
          <Row align="middle" gutter={4} style={{ marginBottom: 6 }}>
            <Col>
              <Button
                type="text"
                size="small"
                icon={visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => setVisible(v => !v)}
                style={{ color: '#8c8c8c', padding: 0, height: 'auto' }}
                aria-label={visible ? 'Hide amounts' : 'Show amounts'}
              />
            </Col>
            <Col>
              <Text style={{ fontSize: 13, fontFamily: 'Noto Sans Myanmar', color: '#333' }}>
                Cash In/Out
              </Text>
            </Col>
          </Row>
          {loading ? (
            <Skeleton.Input active size="small" style={{ width: 120 }} />
          ) : (
            <Text strong style={{ fontSize: 19, fontFamily: 'Segoe UI', color: '#000' }}>
              {cashInDisplay}
            </Text>
          )}
        </Col>

        {/* Fee / Profit column */}
        <Col flex="1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Row align="middle" gutter={4} style={{ marginBottom: 6 }}>
            <Col>
              <Button
                type="text"
                size="small"
                icon={visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => setVisible(v => !v)}
                style={{ color: '#8c8c8c', padding: 0, height: 'auto' }}
                aria-label={visible ? 'Hide amounts' : 'Show amounts'}
              />
            </Col>
            <Col>
              <Text style={{ fontSize: 13, fontFamily: 'Noto Sans Myanmar', color: '#333' }}>
                Fee/Profit
              </Text>
            </Col>
          </Row>
          {loading ? (
            <Skeleton.Input active size="small" style={{ width: 120 }} />
          ) : (
            <Text strong style={{ fontSize: 19, fontFamily: 'Segoe UI', color: '#000' }}>
              {cashOutDisplay}
            </Text>
          )}
        </Col>
      </Row>
    </Card>
  );
}
