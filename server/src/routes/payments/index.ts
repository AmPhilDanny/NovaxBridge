import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';

export const paymentsRouter: Router = Router();

export interface ExchangeRates {
  base: string;
  updated_at: string;
  rates: Record<string, number>;
}

const CURRENCY_MAP: Record<string, { code: string; symbol: string; gateway: string }> = {
  NG: { code: 'NGN', symbol: '\u20A6', gateway: 'paystack' },
  GH: { code: 'GHS', symbol: '\u20B5', gateway: 'paystack' },
  KE: { code: 'KES', symbol: 'KSh', gateway: 'flutterwave' },
  ZA: { code: 'ZAR', symbol: 'R', gateway: 'flutterwave' },
  UG: { code: 'UGX', symbol: 'USh', gateway: 'flutterwave' },
  TZ: { code: 'TZS', symbol: 'TSh', gateway: 'flutterwave' },
  RW: { code: 'RWF', symbol: 'FRw', gateway: 'flutterwave' },
};

// ── Helpers ──

async function getSiteSetting(key: string): Promise<Record<string, unknown> | null> {
  const { data } = await adminClient.from('site_settings').select('value').eq('key', key).maybeSingle();
  return data?.value as Record<string, unknown> | null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await adminClient.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin' || data?.role === 'super_admin';
}

async function creditWallet(
  profileId: string, amount: number, reference: string, description: string, orderId?: string
): Promise<void> {
  const { data: lastTx } = await adminClient
    .from('wallet_transactions')
    .select('balance_after')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const currentBalance = lastTx ? Number(lastTx.balance_after) : 0;
  await adminClient.from('wallet_transactions').insert({
    profile_id: profileId, type: 'credit', amount, balance_after: currentBalance + amount,
    reference, description, order_id: orderId, status: 'completed',
  });
}

async function releaseEscrow(orderId: string): Promise<{ released: boolean; amount: number; fee: number }> {
  const { data: order, error } = await adminClient.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new AppError(404, 'Order not found');
  if (order.status !== 'in_progress' && order.status !== 'completed') throw new AppError(400, 'Order must be in progress or completed');
  if (order.payment_status !== 'paid') throw new AppError(400, 'Payment not received');

  const serviceFeePct = order.service_fee_percentage || 5;
  const feeAmount = Math.round(Number(order.amount) * serviceFeePct / 100);
  const providerAmount = Number(order.amount) - feeAmount;
  if (order.provider_payout && Number(order.provider_payout) > 0) return { released: false, amount: 0, fee: 0 };

  await creditWallet(order.provider_id, providerAmount, `order-${orderId}-release`, `Payment for order #${orderId.slice(0, 8)} (${serviceFeePct}% fee deducted)`, orderId);
  await adminClient.from('orders').update({ service_fee_amount: feeAmount, provider_payout: providerAmount, escrow_release_at: new Date().toISOString() }).eq('id', orderId);
  await adminClient.from('notifications').insert({
    profile_id: order.provider_id, title: 'Payment received',
    message: `${providerAmount.toLocaleString()} credited for order #${orderId.slice(0, 8)}. Fee: ${feeAmount.toLocaleString()}.`,
    type: 'payment',
  });
  return { released: true, amount: providerAmount, fee: feeAmount };
}

async function releaseMilestoneEscrow(milestoneId: string): Promise<{ released: boolean; amount: number }> {
  const { data: milestone } = await adminClient.from('order_milestones').select('*, orders!inner(*)').eq('id', milestoneId).single();
  if (!milestone) throw new AppError(404, 'Milestone not found');
  if (milestone.status !== 'approved') throw new AppError(400, 'Milestone must be approved first');
  const order = milestone.orders as any;
  if (order.payment_status !== 'paid') throw new AppError(400, 'Order payment not received');

  const amount = Number(milestone.amount);
  const { data: allMilestones } = await adminClient.from('order_milestones').select('amount').eq('order_id', milestone.order_id);
  const totalMilestoneAmount = (allMilestones || []).reduce((sum: number, m: any) => sum + Number(m.amount), 0);
  const serviceFeePct = Number(order.service_fee_percentage) || 5;
  const milestoneFee = Math.round(amount * serviceFeePct / 100);
  const providerAmount = amount - milestoneFee;

  await creditWallet(order.provider_id, providerAmount, `milestone-${milestoneId}-release`, `Milestone "${milestone.title}" approved — ${providerAmount.toLocaleString()} credited`, milestone.order_id);
  await adminClient.from('notifications').insert({
    profile_id: order.provider_id, title: 'Milestone payment received',
    message: `${providerAmount.toLocaleString()} credited for "${milestone.title}".`, type: 'payment',
  });
  return { released: true, amount: providerAmount };
}

// ── GET /currencies ──
paymentsRouter.get('/currencies', async (_req: Request, res: Response) => {
  const currencies = await getSiteSetting('supported_currencies');
  res.json({ data: currencies || [] });
});

// ── GET /detect-currency ──
paymentsRouter.get('/detect-currency', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const fallback = { code: 'NGN', symbol: '\u20A6', name: 'Nigerian Naira' };
  const { data: profile } = await supabase.from('profiles').select('preferred_currency').eq('id', req.user!.id).single();
  if (profile?.preferred_currency) {
    for (const [, curr] of Object.entries(CURRENCY_MAP)) {
      if (curr.code === profile.preferred_currency) {
        return res.json({ data: { code: curr.code, symbol: curr.symbol, name: curr.code } });
      }
    }
  }
  res.json({ data: fallback });
});

// ── GET /service-fee ──
paymentsRouter.get('/service-fee', async (_req: Request, res: Response) => {
  const feeConfig = await getSiteSetting('service_fee');
  res.json({ data: feeConfig || { percentage: 5 } });
});

// ── Admin: gateway config ──
paymentsRouter.get('/gateways', async (req: Request, res: Response) => {
  const admin = await isAdmin(req.user!.id);
  if (!admin) throw new AppError(403, 'Admin access required');
  const gateways = await getSiteSetting('payment_gateways');
  res.json({ data: gateways || {} });
});

paymentsRouter.post('/gateways', async (req: Request, res: Response) => {
  const adminCheck = await isAdmin(req.user!.id);
  if (!adminCheck) throw new AppError(403, 'Admin access required');
  const body = req.body;
  const { data: existing } = await adminClient.from('site_settings').select('id').eq('key', 'payment_gateways').maybeSingle();
  if (existing) {
    await adminClient.from('site_settings').update({ value: body }).eq('key', 'payment_gateways');
  } else {
    await adminClient.from('site_settings').insert({ key: 'payment_gateways', value: body });
  }
  res.json({ data: body });
});

// ── Admin: service fee ──
paymentsRouter.post('/service-fee', async (req: Request, res: Response) => {
  const adminCheck = await isAdmin(req.user!.id);
  if (!adminCheck) throw new AppError(403, 'Admin access required');
  const { percentage } = req.body;
  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) throw new AppError(400, 'Percentage must be 0-100');
  const val = { percentage };
  const { data: existing } = await adminClient.from('site_settings').select('id').eq('key', 'service_fee').maybeSingle();
  if (existing) {
    await adminClient.from('site_settings').update({ value: val }).eq('key', 'service_fee');
  } else {
    await adminClient.from('site_settings').insert({ key: 'service_fee', value: val });
  }
  res.json({ data: val });
});

// ── POST /initialize ──
paymentsRouter.post('/initialize', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { order_id, gateway: preferredGateway } = req.body;
  if (!order_id) throw new AppError(400, 'order_id required');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, buyer:profiles!buyer_id(email, full_name)')
    .eq('id', order_id)
    .single();
  if (orderError || !order) throw new AppError(404, 'Order not found');
  if (order.buyer_id !== req.user!.id) throw new AppError(403, 'Only the buyer can pay');
  if (order.payment_status === 'paid') throw new AppError(400, 'Order already paid');

  const currency = order.currency || 'NGN';
  let gateway = preferredGateway || 'paystack';
  if (!preferredGateway) {
    for (const [, c] of Object.entries(CURRENCY_MAP)) {
      if (c.code === currency) { gateway = c.gateway; break; }
    }
  }

  const amountInKobo = Math.round(Number(order.amount) * 100);

  if (gateway === 'paystack') {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    if (!secretKey) throw new AppError(400, 'Paystack not configured');

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: (order.buyer as any).email || 'customer@example.com',
        amount: amountInKobo, currency,
        reference: `gebeya-${order_id}-${Date.now()}`,
        callback_url: `${process.env.SUPABASE_URL}/functions/v1/marketplace-payments/payments/verify/paystack`,
        metadata: { order_id },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) throw new AppError(502, paystackData.message || 'Paystack initialization failed');

    const { data: intent } = await supabase
      .from('payment_intents')
      .insert({
        order_id, buyer_id: req.user!.id, gateway: 'paystack',
        gateway_reference: paystackData.data.reference, amount: order.amount,
        currency, status: 'pending', authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code, metadata: { reference: paystackData.data.reference },
      })
      .select()
      .single();

    await supabase.from('orders').update({ payment_status: 'pending' }).eq('id', order_id);
    return res.json({ data: { authorization_url: paystackData.data.authorization_url, reference: paystackData.data.reference, gateway: 'paystack', intent_id: intent.id } });
  }

  if (gateway === 'flutterwave') {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    if (!secretKey) throw new AppError(400, 'Flutterwave not configured');

    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: `gebeya-${order_id}-${Date.now()}`,
        amount: Number(order.amount), currency,
        redirect_url: `${process.env.SUPABASE_URL}/functions/v1/marketplace-payments/payments/verify/flutterwave`,
        meta: { order_id },
        customer: { email: (order.buyer as any).email || 'customer@example.com', name: (order.buyer as any).full_name || 'Customer' },
        customizations: { title: 'Gebeya Dala Payment' },
      }),
    });

    const flwData = await flwRes.json();
    if (flwData.status !== 'success') throw new AppError(502, flwData.message || 'Flutterwave initialization failed');

    const { data: intent } = await supabase
      .from('payment_intents')
      .insert({
        order_id, buyer_id: req.user!.id, gateway: 'flutterwave',
        gateway_reference: flwData.data.tx_ref, amount: order.amount,
        currency, status: 'pending', authorization_url: flwData.data.link,
        metadata: { tx_ref: flwData.data.tx_ref },
      })
      .select()
      .single();

    await supabase.from('orders').update({ payment_status: 'pending' }).eq('id', order_id);
    return res.json({ data: { authorization_url: flwData.data.link, reference: flwData.data.tx_ref, gateway: 'flutterwave', intent_id: intent.id } });
  }

  throw new AppError(400, `Unsupported gateway: ${gateway}`);
});

// ── POST /verify/:gateway ──
paymentsRouter.post('/verify/:gateway', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const gatewayName = req.params.gateway;

  if (gatewayName === 'paystack') {
    const { reference } = req.body;
    if (!reference) throw new AppError(400, 'Missing reference');

    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.status || verifyData.data.status !== 'success') throw new AppError(400, 'Payment verification failed');

    const { data: intent } = await supabase.from('payment_intents').select('*').eq('gateway_reference', reference).single();
    if (!intent) throw new AppError(404, 'Payment intent not found');

    await supabase.from('payment_intents').update({ status: 'success' }).eq('id', intent.id);
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', intent.order_id);
    return res.json({ data: { status: 'success', order_id: intent.order_id } });
  }

  if (gatewayName === 'flutterwave') {
    const { transaction_id } = req.body;
    if (!transaction_id) throw new AppError(400, 'Missing transaction_id');

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verifyData = await verifyRes.json();
    if (verifyData.status !== 'success' || verifyData.data.status !== 'successful') throw new AppError(400, 'Flutterwave verification failed');

    const txRef = verifyData.data.tx_ref;
    const { data: intent } = await supabase.from('payment_intents').select('*').eq('gateway_reference', txRef).single();
    if (!intent) throw new AppError(404, 'Payment intent not found');

    await supabase.from('payment_intents').update({ status: 'success' }).eq('id', intent.id);
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', intent.order_id);
    return res.json({ data: { status: 'success', order_id: intent.order_id } });
  }

  throw new AppError(400, `Unknown gateway: ${gatewayName}`);
});

// ── POST /release/:orderId ──
paymentsRouter.post('/release/:orderId', async (req: Request, res: Response) => {
  const result = await releaseEscrow(req.params.orderId as string);
  res.json({ data: result });
});

// ── POST /release-milestone ──
paymentsRouter.post('/release-milestone', async (req: Request, res: Response) => {
  const { milestone_id } = req.body;
  if (!milestone_id) throw new AppError(400, 'milestone_id required');
  const result = await releaseMilestoneEscrow(milestone_id);
  res.json({ data: result });
});

// ── GET /offline-config ──
paymentsRouter.get('/offline-config', async (_req: Request, res: Response) => {
  const config = await getSiteSetting('offline_payment');
  res.json({ data: config || null });
});

// ── GET /rates — exchange rates ──
paymentsRouter.get('/rates', async (_req: Request, res: Response) => {
  const defaultRates: ExchangeRates = {
    base: 'NGN',
    updated_at: new Date().toISOString(),
    rates: {},
  };
  const stored = await getSiteSetting('exchange_rates') as Record<string, unknown> | null;
  if (stored) {
    defaultRates.base = (stored.base as string) || 'NGN';
    defaultRates.rates = (stored.rates as Record<string, number>) || {};
    // Merge in the CURRENCY_MAP codes so all known currencies appear even if rate is 0
    for (const [, c] of Object.entries(CURRENCY_MAP)) {
      if (!(c.code in defaultRates.rates)) defaultRates.rates[c.code] = 0;
    }
    defaultRates.rates[defaultRates.base] = 1;
  }
  res.json({ data: defaultRates });
});

// ── convertPrice helper (used inline in /initialize and /manual) ──
export function convertPrice(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to || !rates[from] || !rates[to]) return amount;
  // Convert: amount (from) → base → amount (to)
  const inBase = from === 'NGN' ? amount : amount / rates[from];
  const result = to === 'NGN' ? inBase : inBase * rates[to];
  return Math.round(result);
}

// ── POST /manual — initiate manual/offline payment ──
paymentsRouter.post('/manual', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { order_id, screenshot_url, notes } = req.body;
  if (!order_id) throw new AppError(400, 'order_id required');

  const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', order_id).single();
  if (orderError || !order) throw new AppError(404, 'Order not found');
  if (order.buyer_id !== req.user!.id) throw new AppError(403, 'Only the buyer can pay');
  if (order.payment_status === 'paid') throw new AppError(400, 'Order already paid');

  const offlineConfig = await getSiteSetting('offline_payment') as Record<string, unknown> | null;
  if (!offlineConfig || !offlineConfig.enabled) throw new AppError(400, 'Offline payment is not enabled');

  const ref = `manual-${order_id}-${Date.now()}`;
  const { data: intent } = await supabase
    .from('payment_intents')
    .insert({ order_id, buyer_id: req.user!.id, gateway: 'manual', gateway_reference: ref, amount: order.amount, currency: order.currency || 'NGN', status: 'pending', metadata: { notes: notes || '' } })
    .select()
    .single();

  if (!intent) throw new AppError(500, 'Failed to create payment intent');

  const { data: manualPayment, error: mpError } = await supabase
    .from('manual_payments')
    .insert({
      order_id, buyer_id: req.user!.id, payment_intent_id: intent.id,
      amount: order.amount, currency: order.currency || 'NGN',
      bank_name: offlineConfig.bank_name as string || '',
      account_number: offlineConfig.account_number as string || '',
      account_name: offlineConfig.account_name as string || '',
      screenshot_url: screenshot_url || null, notes: notes || null, status: 'pending',
    })
    .select()
    .single();

  if (mpError) {
    await supabase.from('payment_intents').delete().eq('id', intent.id);
    throw new AppError(500, 'Failed to record manual payment');
  }

  await supabase.from('orders').update({ payment_status: 'pending' }).eq('id', order_id);
  res.status(201).json({ data: { ...manualPayment, instructions: offlineConfig.instructions as string || '' } });
});

// ── GET /manual — get manual payments ──
paymentsRouter.get('/manual', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const orderId = req.query.order_id as string | undefined;
  let query = supabase.from('manual_payments').select('*').order('created_at', { ascending: false });
  if (orderId) query = query.eq('order_id', orderId);

  const userIsAdmin = await isAdmin(req.user!.id);
  if (!userIsAdmin) query = query.eq('buyer_id', req.user!.id);

  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data: data || [] });
});
