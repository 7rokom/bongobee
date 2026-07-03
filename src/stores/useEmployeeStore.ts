import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';

export type PermissionKey =
  | 'orders' | 'products' | 'blog' | 'employees' | 'resellers' | 'accounts'
  | 'landing_pages' | 'bulk_sms' | 'courier_setup' | 'settings';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  orders: 'অর্ডার ম্যানেজ', products: 'প্রোডাক্ট ম্যানেজ', blog: 'পোস্ট এবং পেজ',
  employees: 'টিম মেম্বার', resellers: 'রিসেলার', accounts: 'একাউন্ট ম্যানেজ',
  landing_pages: 'ল্যান্ডিং পেজ', bulk_sms: 'বাল্ক SMS',
  courier_setup: 'কুরিয়ার সেটাপ', settings: 'সাইট সেটিংস ও ব্যাকআপ',
};

export interface Employee {
  id: string; name: string; email: string; phone: string; role: string;
  password: string; createdAt: string; isActive: boolean; permissions: PermissionKey[];
  assignedResellerIds?: string[]; // whitelist: if set, only orders from these resellers are auto-assigned to this employee
  hiddenResellerIds?: string[]; // blacklist: employee cannot view or be assigned orders from these resellers
  autoAssignMain?: boolean; // default true; if false, this employee will NOT be auto-assigned main (non-reseller) orders
}

export interface EmployeeActivity {
  id: string; employeeId: string; employeeName: string; action: string;
  orderId: string; details: string; timestamp: string;
}

interface EmployeeStore {
  employees: Employee[];
  activities: EmployeeActivity[];
  loading: boolean;
  fetchEmployees: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  addEmployee: (emp: Employee) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  logActivity: (activity: Omit<EmployeeActivity, 'id'>) => Promise<void>;
  getActivitiesByEmployee: (employeeId: string) => EmployeeActivity[];
  getActivitiesByDateRange: (start: Date, end: Date) => EmployeeActivity[];
}

const mapEmp = (r: any): Employee => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone || '', role: r.role || '',
  password: r.password, createdAt: r.created_at || '', isActive: r.is_active ?? true,
  permissions: (r.permissions || []) as PermissionKey[],
  assignedResellerIds: r.assigned_reseller_ids || [],
  hiddenResellerIds: r.hidden_reseller_ids || [],
  autoAssignMain: r.auto_assign_main ?? true,
});

const mapAct = (r: any): EmployeeActivity => ({
  id: r.id, employeeId: r.employee_id, employeeName: r.employee_name,
  action: r.action || '', orderId: r.order_id || '', details: r.details || '',
  timestamp: r.timestamp || '',
});

export const useEmployeeStore = create<EmployeeStore>()(
  persist(
    (set, get) => ({
      employees: [],
      activities: [],
      loading: false,

  fetchEmployees: async () => {
    set({ loading: true });
    try { const data = await api.get('/admin/data/employees'); if (Array.isArray(data)) set({ employees: data.map(mapEmp) }); } catch { /* ignore */ }
    set({ loading: false });
  },

  fetchActivities: async () => {
    try { const data = await api.get('/admin/data/employee-activities'); if (Array.isArray(data)) set({ activities: data.map(mapAct) }); } catch { /* ignore */ }
  },

  addEmployee: async (emp) => {
    try {
      const created = await api.post('/admin/data/employees', {
        name: emp.name, email: emp.email, phone: emp.phone, role: emp.role,
        password: emp.password, is_active: emp.isActive, permissions: emp.permissions,
      });
      set((s) => ({ employees: [...s.employees, created ? mapEmp(created) : emp] }));
    } catch { /* ignore */ }
  },

  updateEmployee: async (id, updates) => {
    const row: any = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.email !== undefined) row.email = updates.email;
    if (updates.phone !== undefined) row.phone = updates.phone;
    if (updates.role !== undefined) row.role = updates.role;
    if (updates.password !== undefined) row.password = updates.password;
    if (updates.isActive !== undefined) row.is_active = updates.isActive;
    if (updates.permissions !== undefined) row.permissions = updates.permissions;
    if (updates.assignedResellerIds !== undefined) row.assigned_reseller_ids = updates.assignedResellerIds;
    if (updates.hiddenResellerIds !== undefined) row.hidden_reseller_ids = updates.hiddenResellerIds;
    if (updates.autoAssignMain !== undefined) row.auto_assign_main = updates.autoAssignMain;
    if (row.password === undefined || row.password === '') delete row.password;
    await api.put(`/admin/data/employees/${id}`, row);
    set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...updates } : e)) }));
  },

  deleteEmployee: async (id) => {
    try { await api.del(`/admin/data/employees/${id}`); set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })); } catch { /* ignore */ }
  },

  logActivity: async (activity) => {
    const id = Date.now().toString();
    const full = { ...activity, id };
    try {
      await api.post('/admin/data/employee-activities', {
        employee_id: activity.employeeId, employee_name: activity.employeeName,
        action: activity.action, order_id: activity.orderId, details: activity.details,
        timestamp: activity.timestamp,
      });
      set((s) => ({ activities: [full, ...s.activities] }));
    } catch { /* ignore */ }
  },

  getActivitiesByEmployee: (employeeId) => get().activities.filter((a) => a.employeeId === employeeId),
  getActivitiesByDateRange: (start, end) => get().activities.filter((a) => {
    const d = new Date(a.timestamp);
    return d >= start && d <= end;
  }),
    }),
    {
      name: 'cache-employees',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ employees: s.employees }),
    }
  )
);
