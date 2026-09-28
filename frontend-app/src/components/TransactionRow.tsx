import { List, Avatar, Typography, Space } from 'antd';
import type { Transaction } from '../api/dashboard';

const { Text } = Typography;

// ─── Wallet badge config ──────────────────────────────────────────────────────

const WALLET_CONFIG: Record<string, { label: string; color: string }> = {
  kbzpay:  { label: 'KPay', color: '#1677ff' },
  wavepay: { label: 'Wave', color: '#fa8c16' },
  cbpay:   { label: 'CB',   color: '#52c41a' },
  ayapay:  { label: 'AYA',  color: '#722ed1' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransactionRowProps {
  tx: Transaction;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TransactionRow({ tx }: TransactionRowProps) {
  const isCashIn    = tx.type === 'cash_in';
  const label       = isCashIn ? 'Cash In' : 'Cash Out';
  const amountColor = isCashIn ? '#65B448' : '#ff4d4f';

  const cfg = WALLET_CONFIG[tx.walletApp] ?? {
    label: tx.walletApp.slice(0, 3).toUpperCase(),
    color: '#8c8c8c',
  };

  return (
    <List.Item
      style={{ padding: '15px 10px', borderBottom: '1px solid #D8D8D8' }}
      extra={
        <Space direction="vertical" align="end" size={2}>
          <Text style={{ fontSize: 15, fontFamily: 'Inter', color: '#000' }}>
            {fmt(tx.balance)} {tx.currency}
          </Text>
          <Text style={{ fontSize: 15, color: amountColor, fontFamily: 'Inter' }}>
            {fmt(tx.amount)} {tx.currency}
          </Text>
        </Space>
      }
    >
      <List.Item.Meta
        avatar={
          <Avatar
            style={{
              backgroundColor: cfg.color,
              fontSize: 10,
              fontWeight: 700,
              width: 35,
              height: 35,
              lineHeight: '35px',
              borderRadius: 8,
            }}
            shape="square"
          >
            {cfg.label}
          </Avatar>
        }
        title={
          <Text style={{ fontSize: 13, fontFamily: 'Noto Sans Myanmar', fontWeight: 500, color: '#4C4C4C' }}>
            {label}
          </Text>
        }
        description={
          <Text style={{ fontSize: 15, fontFamily: 'Inter', color: '#000', marginTop: 4 }}>
            {fmtTime(tx.timestamp)}
          </Text>
        }
      />
    </List.Item>
  );
}
