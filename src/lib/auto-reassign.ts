/**
 * Auto-rebalance pending order assignments between team members based on
 * confirmation speed.
 *
 * Trigger: after an order's status changes to "কনফার্মড" by employee X.
 *
 * Logic:
 *  1. Check X's last-24h work ratio. If (cancelled + currently-pending) > confirmed
 *     in the last 24h → X is actually slow, do NOT give them more work.
 *  2. Otherwise, find employee Y who has the MOST currently-pending orders
 *     (assigned but not yet confirmed/cancelled/etc) — Y ≠ X.
 *  3. Move ONE of Y's oldest pending orders to X.
 *
 * "Pending" here = order.status ∈ {পেন্ডিং, হোল্ড, ফলোয়াপ, এসাইন}
 *                  AND assignedTo === employeeId
 */

const PENDING_STATUSES = ['পেন্ডিং', 'হোল্ড', 'ফলোয়াপ', 'এসাইন'];
const DAY_MS = 24 * 60 * 60 * 1000;

type Src = 'main' | 'reseller';

interface PendingTarget {
  type: Src;
  id: string;
  ts: number;
}

export async function autoReassignToFastWorker(fastEmployeeId: string) {
  if (!fastEmployeeId) return;
  try {
    const [{ useOrderStore }, { useResellerStore }, { useEmployeeStore }] = await Promise.all([
      import('@/stores/useOrderStore'),
      import('@/stores/useResellerStore'),
      import('@/stores/useEmployeeStore'),
    ]);

    const employees = useEmployeeStore.getState().employees.filter(
      e => e.isActive && e.permissions?.includes('orders')
    );
    if (employees.length < 2) return;

    const mainOrders = useOrderStore.getState().orders;
    const resellerOrders = useResellerStore.getState().orders;
    let activities = useEmployeeStore.getState().activities;
    if (activities.length === 0) {
      try { await useEmployeeStore.getState().fetchActivities(); } catch {}
      activities = useEmployeeStore.getState().activities;
    }

    // === Step 1: 24h ratio check for fast employee ===
    const now = Date.now();
    const dayAgo = now - DAY_MS;

    const fastActs = activities.filter(
      a => a.employeeId === fastEmployeeId && new Date(a.timestamp).getTime() >= dayAgo
    );
    const fastConfirmed24 = fastActs.filter(a => a.action === 'order_confirmed').length;
    const fastCancelled24 = fastActs.filter(a => a.action === 'order_cancelled').length;
    const fastHold24 = fastActs.filter(a => a.action === 'order_hold' || a.action === 'order_held').length;

    if ((fastCancelled24 + fastHold24) > fastConfirmed24) {
      console.log('[auto-reassign] fast employee ratio not good (cancel+hold > confirmed), skipping', {
        fastEmployeeId, fastConfirmed24, fastCancelled24, fastHold24,
      });
      return;
    }


    // === Step 2: find slowest other employee (most pending) ===
    const board = employees
      .filter(e => e.id !== fastEmployeeId)
      .map(e => {
        const mp: PendingTarget[] = mainOrders
          .filter(o => o.assignedTo === e.id && PENDING_STATUSES.includes(o.status))
          .map(o => ({ type: 'main' as const, id: o.id, ts: new Date(o.isoDate || o.date || 0).getTime() || 0 }));
        const rp: PendingTarget[] = resellerOrders
          .filter(o => o.assignedTo === e.id && PENDING_STATUSES.includes(o.status))
          .map(o => ({ type: 'reseller' as const, id: o.id, ts: new Date(o.date || 0).getTime() || 0 }));
        return { emp: e, pending: [...mp, ...rp] };
      })
      .filter(x => x.pending.length >= 2) // keep at least 1 order with them
      .sort((a, b) => b.pending.length - a.pending.length);

    if (board.length === 0) return;

    const slowest = board[0];
    // Oldest pending first
    slowest.pending.sort((a, b) => a.ts - b.ts);
    const target = slowest.pending[0];

    const fastEmp = useEmployeeStore.getState().employees.find(e => e.id === fastEmployeeId);
    if (!fastEmp) return;

    // === Step 3: reassign one order ===
    if (target.type === 'main') {
      await useOrderStore.getState().assignOrder(target.id, fastEmp.id, fastEmp.name);
    } else {
      await useResellerStore.getState().assignResellerOrder(target.id, fastEmp.id, fastEmp.name);
    }

    console.log(`[auto-reassign] moved ${target.type} order ${target.id} from ${slowest.emp.name} → ${fastEmp.name}`);
  } catch (e) {
    console.warn('[auto-reassign] failed:', e);
  }
}
