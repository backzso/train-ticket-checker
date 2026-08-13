import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { TelegramBot } from './telegram-bot';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('TELEGRAM_BOT_TOKEN environment variable is required');
  process.exit(1);
}

/**
 * Webhook'u doğrulamak için gizli anahtar. Telegram her istekte
 * bu değeri başlıkta geri gönderir, böylece sahte istekler elenir.
 */
const webhookSecret = process.env.WEBHOOK_SECRET;

/** Webhook'un kurulacağı genel adres (örn. https://xyz.onrender.com). */
const publicUrl = process.env.PUBLIC_URL;

app.use(express.json());

const bot = new TelegramBot(botToken);

app.post('/webhook', async (req, res) => {
  if (webhookSecret && req.get('X-Telegram-Bot-Api-Secret-Token') !== webhookSecret) {
    console.warn(`[${new Date().toISOString()}] Geçersiz webhook secret ile istek reddedildi`);
    return res.status(401).send('Unauthorized');
  }

  // Telegram'a hemen yanıt ver; işlemeyi arka planda sürdür.
  // Aksi halde yavaş bir kontrol Telegram'ın isteği tekrar göndermesine yol açar.
  res.status(200).send('OK');

  try {
    await bot.handleUpdate(req.body);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Webhook işlenemedi:`, error);
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * Telegram'a webhook adresini bildirir.
 * PUBLIC_URL tanımlı değilse atlanır (yerel geliştirme).
 */
async function registerWebhook(): Promise<void> {
  if (!publicUrl) {
    console.log(`[${new Date().toISOString()}] PUBLIC_URL tanımlı değil, webhook otomatik kurulmadı.`);
    console.log(`[${new Date().toISOString()}] Kurmak için: curl -F "url=https://<adresiniz>/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook`);
    return;
  }

  const url = `${publicUrl.replace(/\/$/, '')}/webhook`;

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      url,
      secret_token: webhookSecret || undefined,
      allowed_updates: ['message']
    });
    console.log(`[${new Date().toISOString()}] Webhook kuruldu: ${url}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] Webhook kurulamadı:`, error.response?.data ?? error.message);
    } else {
      console.error(`[${new Date().toISOString()}] Webhook kurulamadı:`, error);
    }
  }
}

const server = app.listen(PORT, async () => {
  console.log(`[${new Date().toISOString()}] Telegram bot sunucusu ${PORT} portunda başladı`);

  if (!webhookSecret) {
    console.warn(`[${new Date().toISOString()}] UYARI: WEBHOOK_SECRET tanımlı değil, webhook doğrulaması kapalı.`);
  }

  await bot.restore();
  await registerWebhook();
});

function shutdown(signal: string): void {
  console.log(`[${new Date().toISOString()}] ${signal} alındı, sunucu kapatılıyor...`);
  server.close(() => process.exit(0));

  // Bağlantılar kapanmazsa zorla çık.
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
