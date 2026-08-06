import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { adminClient } from '../../lib/supabase-admin.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/error.js';

export const walletRouter: Router = Router();

const VALID_PAYOUT_STATUSES = ['pending', 'processing', 'paid', 'rejected'];

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await adminClient.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin' || data?.role === 'super_admin';
}

// ── GET /wallet/balance ──
walletRouter.get('/balance', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('type, amount')
    .eq('profile_id', req.user!.id)
    .eq('status', 'completed');
  if (error) throw new AppError(500, error.message);

  const balance = (data || []).reduce((sum, tx: any) => {
    if (tx.type === 'credit' || tx.type === 'bonus') return sum + Number(tx.amount);
    return sum - Number(tx.amount);
  }, 0);

  res.json({ data: { balance, transaction_count: data?.length || 0 } });
});

// ── GET /wallet/transactions ──
walletRouter.get('/transactions', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const type = req.query.type as string | undefined;

  let query = supabase
    .from('wallet_transactions')
    .select('*')
    .eq('profile_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw new AppError(500, error.message);
  res.json({ data, limit, offset });
});

// ── GET /payouts ──
walletRouter.get('/payouts', async (req: Request, res: Response) => {
  const userIsAdmin = await isAdmin(req.user!.id);
  let query = adminClient
    .from('payouts')
    .select('*, profile:profiles(id, full_name, avatar_url)')
    .order('created_at', { ascending: false });

  if (!userIsAdmin) query = query.eq('profile_id', req.user!.id);

  const { data, error } = await query;
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── POST /payouts — request payout ──
walletRouter.post('/payouts',
  validate(z.object({
    amount: z.number().positive(),
    bank_name: z.string().min(1),
    account_number: z.string().min(1),
    account_name: z.string().min(1),
  })),
  async (req: Request, res: Response) => {
    const supabase = req.supabaseClient!;
    const { amount, bank_name, account_number, account_name } = req.body;

    // Check balance
    const { data: txs } = await supabase
      .from('wallet_transactions')
      .select('type, amount')
      .eq('profile_id', req.user!.id)
      .eq('status', 'completed');

    const balance = (txs || []).reduce((sum: number, tx: any) => {
      if (tx.type === 'credit' || tx.type === 'bonus') return sum + Number(tx.amount);
      return sum - Number(tx.amount);
    }, 0);

    if (balance < amount) throw new AppError(400, `Insufficient balance. Available: ${balance}`);

    const { data, error } = await supabase
      .from('payouts')
      .insert({ profile_id: req.user!.id, amount, bank_name, account_number, account_name, status: 'pending' })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    res.status(201).json({ data });
  }
);

// ── PATCH /payouts/:id — admin approve/reject ──
walletRouter.patch('/payouts/:id', async (req: Request, res: Response) => {
  const userIsAdmin = await isAdmin(req.user!.id);
  if (!userIsAdmin) throw new AppError(403, 'Admin access required');

  const { status: newStatus, admin_notes } = req.body;
  if (!newStatus || !VALID_PAYOUT_STATUSES.includes(newStatus)) {
    throw new AppError(400, `Invalid status. Must be one of: ${VALID_PAYOUT_STATUSES.join(', ')}`);
  }

  const { data, error } = await adminClient
    .from('payouts')
    .update({ status: newStatus, admin_notes: admin_notes || null })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw new AppError(500, error.message);
  res.json({ data });
});

// ── GET /bank-account — get logged-in user's bank account ──
walletRouter.get('/bank-account', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { data, error } = await supabase
    .from('provider_bank_accounts')
    .select('*')
    .eq('profile_id', req.user!.id)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'No bank account found');
  res.json({ data });
});

// ── POST /bank-account — save/update bank account ──
walletRouter.post('/bank-account', async (req: Request, res: Response) => {
  const supabase = req.supabaseClient!;
  const { bank_name, account_number, account_name, routing_number, swift_code, country } = req.body;

  if (!bank_name || !account_number || !account_name) {
    throw new AppError(400, 'Missing required fields: bank_name, account_number, account_name');
  }

  // Name validation
  const nameParts = account_name.trim().split(/\s+/);
  if (nameParts.length < 2) {
    throw new AppError(400, 'Account name must include at least first and last name');
  }

  // Cross-check with profile name
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', req.user!.id).single();
  if (profile?.full_name) {
    const profileWords = profile.full_name.toLowerCase().split(/\s+/).filter(Boolean);
    const accountWords = account_name.toLowerCase().split(/\s+/).filter(Boolean);
    const matchedWords = profileWords.filter((w: string) => accountWords.includes(w));
    if (matchedWords.length < 2) {
      throw new AppError(400, `Account name must match your profile name (${profile.full_name})`);
    }
  }

  // Upsert
  const { data: existing } = await supabase
    .from('provider_bank_accounts')
    .select('id')
    .eq('profile_id', req.user!.id)
    .maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from('provider_bank_accounts')
      .update({
        bank_name, account_number, account_name,
        routing_number: routing_number || null, swift_code: swift_code || null,
        country: country || 'NG', kyc_status: 'unverified', verified_by: null, verified_at: null,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    result = data;
  } else {
    const { data, error } = await supabase
      .from('provider_bank_accounts')
      .insert({
        profile_id: req.user!.id, bank_name, account_number, account_name,
        routing_number: routing_number || null, swift_code: swift_code || null,
        country: country || 'NG', kyc_status: 'unverified',
      })
      .select()
      .single();
    if (error) throw new AppError(500, error.message);
    result = data;
  }

  res.status(existing ? 200 : 201).json({ data: result });
});
