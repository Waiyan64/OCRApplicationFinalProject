// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  name: string;
  premiumDaysLeft: number;
  role: 'free' | 'subscribed' | 'admin';
}

export interface Summary {
  cashIn: number;
  cashOut: number;
  currency: string;
}

export interface Transaction {
  id: string;
  walletApp: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  fee: number;
  balance: number;
  currency: string;
  timestamp: string;
}

export interface TransactionPage {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FeeTier {
  id: number;
  minAmount: number;
  maxAmount: number;
  fee: number;
}

export interface JobResult {
  jobId: string;
  status: 'pending' | 'processing' | 'awaiting_confirmation' | 'processed' | 'failed' | 'rejected';
  walletApp: string;
  txType: string | null;
  result: OcrResult | null;
  confirmedAmount?: number | null;
}

export interface OcrFieldPrediction {
  value: string | null;
  confidence: number;
  source_text: string | null;
}

export interface OcrResult {
  job_id: string;
  status: 'processed' | 'failed';
  wallet_app_type: string;
  fields: {
    amount: OcrFieldPrediction;
    tx_id: OcrFieldPrediction;
    tx_type: OcrFieldPrediction;
    timestamp: OcrFieldPrediction;
    fee: OcrFieldPrediction;
    balance: OcrFieldPrediction;
  };
  processing_ms: number;
  error: string | null;
}

// ─── Base helpers ─────────────────────────────────────────────────────────────

// Since Vite proxies /api to localhost:3000, we can just use relative path to avoid CORS.
const BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api` : '/api';
const BASE_DASHBOARD = `${BASE}/dashboard`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { ...getAuthHeaders(), 'Content-Type': undefined } as HeadersInit });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    throw new Error(`API error ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE', headers: { ...getAuthHeaders(), 'Content-Type': undefined } as HeadersInit });
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export const login = (email: string, password: string): Promise<{ access_token: string, user: any }> =>
  post(`${BASE}/auth/login`, { email, password });

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const fetchProfile = (): Promise<Profile> =>
  get<Profile>(`${BASE_DASHBOARD}/profile`);

export const fetchSummary = (): Promise<Summary> =>
  get<Summary>(`${BASE_DASHBOARD}/summary`);

export const fetchRecentTransactions = (): Promise<Transaction[]> =>
  get<Transaction[]>(`${BASE_DASHBOARD}/transactions/recent`);

// ─── Transactions ─────────────────────────────────────────────────────────────

export const fetchTransactions = (params?: {
  type?: 'cash_in' | 'cash_out';
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
}): Promise<TransactionPage> => {
  const q = new URLSearchParams();
  if (params?.type) q.set('type', params.type);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.fromDate) q.set('fromDate', params.fromDate);
  if (params?.toDate) q.set('toDate', params.toDate);
  const qs = q.toString();
  return get<TransactionPage>(`${BASE}/transactions${qs ? `?${qs}` : ''}`);
};

// ─── Fee Tiers ────────────────────────────────────────────────────────────────

export const fetchFeeTiers = (): Promise<FeeTier[]> =>
  get<FeeTier[]>(`${BASE}/fee-tiers`);

export const createFeeTier = (tier: Omit<FeeTier, 'id'>): Promise<FeeTier> =>
  post<FeeTier>(`${BASE}/fee-tiers`, tier);

export const updateFeeTier = (id: number, tier: Partial<Omit<FeeTier, 'id'>>): Promise<FeeTier> =>
  patch<FeeTier>(`${BASE}/fee-tiers/${id}`, tier);

export const deleteFeeTier = (id: number): Promise<{ deleted: true }> =>
  del<{ deleted: true }>(`${BASE}/fee-tiers/${id}`);

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const fetchJob = (jobId: string): Promise<JobResult> =>
  get<JobResult>(`${BASE}/jobs/${jobId}`);

export const fetchPendingReviews = (): Promise<JobResult[]> =>
  get<JobResult[]>(`${BASE}/jobs/pending-review`);

export const confirmJobAmount = (jobId: string, amount: number): Promise<{ jobId: string; status: 'processed'; confirmedAmount: number }> =>
  post(`${BASE}/jobs/${encodeURIComponent(jobId)}/confirm`, { amount });

export const rejectJob = (jobId: string): Promise<{ jobId: string; status: 'rejected' }> =>
  post(`${BASE}/jobs/${encodeURIComponent(jobId)}/reject`, {});

/** Polls a job until it reaches a terminal state or maxAttempts is exceeded. */
export async function pollJob(
  jobId: string,
  onUpdate?: (result: JobResult) => void,
  intervalMs = 2000,
  maxAttempts = 30,
): Promise<JobResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fetchJob(jobId);
    onUpdate?.(result);
    if (result.status === 'awaiting_confirmation' || result.status === 'processed' || result.status === 'failed' || result.status === 'rejected') return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Job ${jobId} did not complete within ${maxAttempts} polls`);
}

// ─── OCR Upload ───────────────────────────────────────────────────────────────

export interface UploadResponse {
  job_id: string;
  status: 'processing';
}

export const submitOcrUpload = (
  file: File,
  walletAppType: string,
  txType: 'cash_in' | 'cash_out',
): Promise<UploadResponse> => {
  const form = new FormData();
  form.append('image', file);
  form.append('wallet_app_type', walletAppType);
  form.append('tx_type', txType);
  form.append('metadata_json', JSON.stringify({ tx_type: txType }));

  const token = localStorage.getItem('token');
  const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

  return fetch(`${BASE}/v1/ocr/process-upload`, { method: 'POST', body: form, headers })
    .then(r => {
      if (!r.ok) {
        if (r.status === 401) {
          localStorage.removeItem('token');
          window.location.reload();
        }
        throw new Error(`Upload error ${r.status}`);
      }
      return r.json() as Promise<UploadResponse>;
    });
};
