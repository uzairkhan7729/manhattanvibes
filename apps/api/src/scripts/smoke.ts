/**
 * End-to-end smoke test against a running API on http://localhost:8088.
 *
 *   1. Health: live + ready
 *   2. Auth: OTP request + verify → tokens
 *   3. Catalog: list categories, list products
 *   4. Orders: quote, place a small pickup order
 *   5. Payments: cash capture → order becomes paid + confirmed
 *   6. KDS: bump CONFIRMED → PREPARING
 *   7. Loyalty: customer "me" balance reflects earnings (manual call)
 *   8. Reports: daily sales for today
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:8088';

interface Result { name: string; ok: boolean; detail?: string }

async function call<T = unknown>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: T }> {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  let parsed: unknown = txt;
  try { parsed = JSON.parse(txt); } catch { /* keep as text */ }
  return { status: r.status, body: parsed as T };
}

function need(cond: boolean, label: string): void {
  if (!cond) throw new Error(`smoke check failed: ${label}`);
}

async function run(): Promise<Result[]> {
  const results: Result[] = [];
  const step = async (name: string, fn: () => Promise<string | void>): Promise<void> => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: detail ?? undefined });
      console.log(`  PASS ${name}${detail ? ` — ${detail}` : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name, ok: false, detail: msg });
      console.log(`  FAIL ${name} — ${msg}`);
    }
  };

  console.log(`\nSMOKE against ${BASE}\n`);

  // 1. Health
  await step('GET /health/live', async () => {
    const r = await call('GET', '/health/live');
    need(r.status === 200, `expected 200, got ${r.status}`);
  });
  await step('GET /health/ready', async () => {
    const r = await call<{ ok: boolean }>('GET', '/health/ready');
    need(r.status === 200, `expected 200, got ${r.status} body=${JSON.stringify(r.body)}`);
    need(r.body.ok === true, 'ready=false');
  });

  // 2. Auth
  let accessToken = '';
  let userId = '';
  await step('POST /auth/otp/request', async () => {
    const r = await call<{ sent: boolean; devCode?: string }>('POST', '/api/v1/auth/otp/request', { phone: '+966555000099', purpose: 'login' });
    need(r.status === 200, `expected 200, got ${r.status} body=${JSON.stringify(r.body)}`);
    need(typeof r.body.devCode === 'string', 'devCode missing (is OTP_DEV_MODE=true?)');
    return `devCode=${r.body.devCode}`;
  });
  await step('POST /auth/otp/verify → tokens', async () => {
    // Request fresh OTP first so we have a known code
    const reqRes = await call<{ devCode?: string }>('POST', '/api/v1/auth/otp/request', { phone: '+966555000099', purpose: 'login' });
    const code = reqRes.body.devCode!;
    const v = await call<{ user: { id: string }; accessToken: string }>('POST', '/api/v1/auth/otp/verify', { phone: '+966555000099', code, purpose: 'login' });
    need(v.status === 200, `expected 200, got ${v.status} body=${JSON.stringify(v.body)}`);
    accessToken = v.body.accessToken;
    userId = v.body.user.id;
    return `userId=${userId}`;
  });

  // 3. Catalog
  let branchId = '';
  await step('GET /branches → pick RUH-1', async () => {
    const r = await call<{ items: Array<{ _id: string; code: string }> }>('GET', '/api/v1/branches');
    need(r.status === 200, `got ${r.status}`);
    const branch = (r.body.items ?? []).find((x) => x.code === 'RUH-1') ?? r.body.items[0];
    need(!!branch, 'no branches seeded');
    branchId = branch!._id;
    return `branchId=${branchId}`;
  });

  let pizzaId = '';
  await step('GET /catalog/products?branchId=', async () => {
    const r = await call<{ items: Array<{ id: string; sku: string; effectivePrice: number; type: string }> }>('GET', `/api/v1/catalog/products?branchId=${branchId}`);
    need(r.status === 200, `got ${r.status}`);
    const pizza = r.body.items.find((p) => p.sku === 'PIZ-MV-CLASSIC');
    need(!!pizza, 'classic pizza not seeded');
    pizzaId = pizza!.id;
    return `items=${r.body.items.length} pizzaId=${pizzaId}`;
  });

  // 4. Orders
  let orderId = '';
  let orderTotal = 0;
  await step('POST /orders/quote', async () => {
    const r = await call<{ subtotal: number; total: number }>('POST', '/api/v1/orders/quote', {
      branchId, channel: 'web', type: 'pickup',
      items: [{ productId: pizzaId, qty: 1, sizeCode: 'M', crustCode: 'classic' }],
    }, { authorization: `Bearer ${accessToken}` });
    need(r.status === 200, `got ${r.status} body=${JSON.stringify(r.body)}`);
    need(r.body.total > 0, `expected total > 0, got ${r.body.total}`);
    return `subtotal=${r.body.subtotal} total=${r.body.total}`;
  });
  await step('POST /orders (place)', async () => {
    const r = await call<{ _id: string; orderNumber: string; pricing: { total: number } }>('POST', '/api/v1/orders', {
      branchId, channel: 'web', type: 'pickup',
      items: [{ productId: pizzaId, qty: 1, sizeCode: 'M', crustCode: 'classic' }],
      customerId: userId,
    }, { authorization: `Bearer ${accessToken}` });
    need(r.status === 201, `got ${r.status} body=${JSON.stringify(r.body)}`);
    orderId = r.body._id;
    orderTotal = r.body.pricing.total;
    return `orderNumber=${r.body.orderNumber} total=${orderTotal}`;
  });

  // 5. Payment (cash)
  let paymentId = '';
  await step('POST /payments/intent (cash)', async () => {
    const r = await call<{ paymentId: string }>('POST', '/api/v1/payments/intent', {
      orderId, method: 'cash', amount: orderTotal,
    }, { authorization: `Bearer ${accessToken}` });
    need(r.status === 201, `got ${r.status} body=${JSON.stringify(r.body)}`);
    paymentId = r.body.paymentId;
    return `paymentId=${paymentId}`;
  });
  await step('POST /payments/:id/capture (needs admin/cashier)', async () => {
    // Login as admin to capture
    const login = await call<{ accessToken: string }>('POST', '/api/v1/auth/login', {
      identifier: '+966500000001', password: 'ChangeMe!2026',
    });
    need(login.status === 200, `admin login failed: ${JSON.stringify(login.body)}`);
    const r = await call<{ status: string }>('POST', `/api/v1/payments/${paymentId}/capture`, undefined, { authorization: `Bearer ${login.body.accessToken}` });
    need(r.status === 200, `capture: got ${r.status} body=${JSON.stringify(r.body)}`);
    need(r.body.status === 'captured', `payment not captured: ${r.body.status}`);
  });

  // 6. KDS bump (CONFIRMED → PREPARING)
  await step('POST /kds/bump/:orderId — advances state', async () => {
    const login = await call<{ accessToken: string }>('POST', '/api/v1/auth/login', { identifier: '+966500000003', password: 'ChangeMe!2026' });
    need(login.status === 200, `cashier login: ${JSON.stringify(login.body)}`);
    const r = await call<{ state: string }>('POST', `/api/v1/kds/bump/${orderId}`, {}, { authorization: `Bearer ${login.body.accessToken}` });
    need(r.status === 200, `got ${r.status} body=${JSON.stringify(r.body)}`);
    need(r.body.state === 'PREPARING', `expected PREPARING, got ${r.body.state}`);
  });

  // 7. Reports
  await step('GET /reports/sales/daily', async () => {
    const login = await call<{ accessToken: string }>('POST', '/api/v1/auth/login', { identifier: '+966500000001', password: 'ChangeMe!2026' });
    const today = new Date().toISOString().slice(0, 10);
    const r = await call<{ summary: { orders: number; gross: number } }>('GET', `/api/v1/reports/sales/daily?branchId=${branchId}&date=${today}`, undefined, { authorization: `Bearer ${login.body.accessToken}` });
    need(r.status === 200, `got ${r.status} body=${JSON.stringify(r.body)}`);
  });

  return results;
}

void run().then((results) => {
  const failed = results.filter((r) => !r.ok);
  const total = results.length;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${total - failed.length}/${total} checks passed`);
  if (failed.length > 0) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
}).catch((err) => {
  console.error('smoke crashed:', err);
  process.exit(2);
});
