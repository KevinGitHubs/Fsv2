import { verifyKey } from 'discord-interactions';
import { supabase } from '../supabase.js';

export default async function handler(req, res) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const rawBody = JSON.stringify(req.body);
  const isValid = verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);
  if (!isValid) return res.status(401).send('Invalid signature');

  const { type, data, message } = req.body;

  if (type === 1) return res.status(200).json({ type: 1 });

  if (type === 3 && data.custom_id.startsWith('done_')) {
    const orderId = data.custom_id.replace('done_', '');
    const { error } = await supabase
      .from('orders')
      .update({ status: 'done' })
      .eq('id', orderId);
    if (error) {
      return res.status(200).json({
        type: 4,
        data: {
          content: `❌ Gagal update pesanan #${orderId}`,
          flags: 64
        }
      });
    }
    const webhookUrl = `https://discord.com/api/webhooks/${process.env.DISCORD_WEBHOOK_ID}/${process.env.DISCORD_WEBHOOK_TOKEN}/messages/${message.message.id}`;
    await fetch(webhookUrl, { method: 'DELETE' });

    return res.status(200).json({
      type: 4,
      data: {
        content: `✅ Pesanan #${orderId} sudah selesai!`,
        flags: 64
      }
    });
  }

  return res.status(404).send('Unknown interaction');
}
