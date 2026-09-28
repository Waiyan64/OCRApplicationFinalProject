export interface AdminStats {
    totalUsers: number;
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    successRate: number;
    totalVolume: number;
    chartData: Array<{ date: string; jobs: number }>;
}

export interface UserRow {
    id: number;
    name: string;
    email: string;
    role: 'free' | 'subscribed' | 'admin';
    premiumExpiresAt: string | null;
    createdAt: string;
    jobsCount?: number;
    txCount?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

const BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api/admin` : '/api/admin';

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`API Error ${res.status}: ${url}`);
    return res.json() as Promise<T>;
}

export const fetchStats = () => fetcher<AdminStats>(`${BASE}/stats`);

export const fetchUsers = (page = 1, limit = 20) =>
    fetcher<PaginatedResult<UserRow>>(`${BASE}/users?page=${page}&limit=${limit}`);

export const updateUser = (id: number, payload: Partial<UserRow>) =>
    fetcher<UserRow>(`${BASE}/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

export const fetchJobs = (page = 1, limit = 20, status?: string) => {
    let url = `${BASE}/jobs?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    return fetcher<PaginatedResult<any>>(url);
};

export const fetchTransactions = (page = 1, limit = 20) =>
    fetcher<PaginatedResult<any>>(`${BASE}/transactions?page=${page}&limit=${limit}`);
