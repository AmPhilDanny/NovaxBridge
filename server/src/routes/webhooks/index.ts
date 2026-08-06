import { Router, Request, Response } from 'express';
import { adminClient } from '../../lib/supabase-admin.js';
import { AppError } from '../../middleware/error.js';

export const webhooksRouter: Router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── POST /webhooks/paystack ──
webhooksRouter.post('/paystack', async (req: Request, res: Response) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new AppError(500, 'Paystack not configured');

  const signature = req.headers['x-paystack-signature'] as string;
  const body = JSON.stringify(req.body);

  // HMAC-SHA512 verification
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(body);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const expectedSignature = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (req.body.event === 'charge.success') {
    const ref = req.body.data?.reference;
    if (ref) {
      const { data: intent } = await adminClient
        .from('payment_intents')
        .select('order_id')
        .eq('gateway_reference', ref)
        .single();
      if (intent) {
        await adminClient.from('payment_intents').update({ status: 'success' }).eq('gateway_reference', ref);
        await adminClient.from('orders').update({ payment_status: 'paid' }).eq('id', intent.order_id);
      }
    }
  }

  res.json({ status: 'ok' });
});

// ── POST /webhooks/flutterwave ──
webhooksRouter.post('/flutterwave', async (req: Request, res: Response) => {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secretHash) throw new AppError(500, 'Flutterwave secret hash not configured');

  // Verify Flutterwave webhook signature via verif-hash header
  const signature = req.headers['verif-hash'] as string;
  if (!signature || signature !== secretHash) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = req.body;

  if (body.event === 'charge.completed' && body.data?.status === 'successful') {
    const txRef = body.data?.tx_ref;
    if (txRef) {
      const { data: intent } = await adminClient
        .from('payment_intents')
        .select('order_id')
        .eq('gateway_reference', txRef)
        .single();
      if (intent) {
        await adminClient.from('payment_intents').update({ status: 'success' }).eq('gateway_reference', txRef);
        await adminClient.from('orders').update({ payment_status: 'paid' }).eq('id', intent.order_id);
      }
    }
  }

  res.json({ status: 'ok' });
});
