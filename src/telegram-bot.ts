import { promises as fs } from 'fs';
import path from 'path';
import { Config, localDate } from './config';
import { fetchSeatAvailabilityForDate } from './fetcher';
import { parseSeatAvailability } from './parser';
import { sendTelegramNotification, sendTelegramMessage } from './notifier';
import { findStation, formatStationList, STATIONS } from './stations';

const STATE_FILE = process.env.BOT_STATE_FILE || path.join(process.cwd(), 'bot-state.json');

/** Aynı seferi tekrar tekrar bildirmemek için hatırlama süresi. */
const NOTIFICATION_MEMORY_MS = 60 * 60 * 1000;

export interface BotState {
  isActive: boolean;
  route: {
    departure: string;
    arrival: string;
    departureId: number;
    arrivalId: number;
  };
  date: string;
  interval: number; // dakika
  lastCheck: string;
  chatId: string;
  /** Daha önce bildirilen seferler: key -> bildirim zamanı (ms). */
  notified?: Record<string, number>;
}

export class TelegramBot {
  private botToken: string;
  private state: Map<string, BotState> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Kayıtlı durumu diskten yükler ve aktif kontrolleri yeniden başlatır.
   * Sunucu yeniden başladığında kullanıcıların ayarları kaybolmaz.
   */
  async restore(): Promise<void> {
    try {
      const raw = await fs.readFile(STATE_FILE, 'utf8');
      const saved: BotState[] = JSON.parse(raw);

      for (const state of saved) {
        this.state.set(state.chatId, state);
      }

      const active = saved.filter(s => s.isActive);
      console.log(`[${new Date().toISOString()}] ${saved.length} sohbet yüklendi, ${active.length} aktif`);

      for (const state of active) {
        this.scheduleChecks(state.chatId);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[${new Date().toISOString()}] Durum yüklenemedi:`, error);
      }
    }
  }

  /** Durumu diske yazar. Hata ana akışı durdurmaz. */
  private async persist(): Promise<void> {
    try {
      const data = JSON.stringify(Array.from(this.state.values()), null, 2);
      await fs.writeFile(STATE_FILE, data, 'utf8');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Durum kaydedilemedi:`, error);
    }
  }

  async handleUpdate(update: any): Promise<void> {
    const message = update?.message;
    if (!message) return;

    const chatId = message.chat?.id?.toString();
    if (!chatId) return;

    // Metin olmayan mesajlar (foto, sticker, konum...) yok sayılır.
    const text: unknown = message.text;
    if (typeof text !== 'string' || !text.trim()) return;

    const from = message.from ?? {};
    console.log(`[${new Date().toISOString()}] ${from.username || from.first_name || 'bilinmeyen'}: ${text}`);

    const [command, ...args] = text.trim().split(/\s+/);
    const normalizedCommand = command.toLowerCase().split('@')[0];

    try {
      switch (normalizedCommand) {
        case '/start':
        case '/help':
          await this.handleStart(chatId);
          break;
        case '/check':
          await this.handleCheck(chatId);
          break;
        case '/stop':
          await this.handleStop(chatId);
          break;
        case '/status':
          await this.handleStatus(chatId);
          break;
        case '/now':
          await this.handleNow(chatId);
          break;
        case '/stations':
          await this.sendMessage(chatId, `🚉 *Desteklenen İstasyonlar*\n\n${formatStationList()}`);
          break;
        case '/setroute':
          await this.handleSetRoute(chatId, args);
          break;
        case '/setdate':
          await this.handleSetDate(chatId, args);
          break;
        case '/setinterval':
          await this.handleSetInterval(chatId, args);
          break;
        default:
          await this.sendMessage(chatId, '❓ Bilinmeyen komut. /start yazarak yardım alabilirsiniz.');
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Komut hatası:`, error);
      await this.sendMessage(chatId, '❌ Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  }

  private async handleStart(chatId: string): Promise<void> {
    const message = `🚀 *TCDD Koltuk Kontrol Botu*\n\n` +
      `*Komutlar:*\n` +
      `• /check - Otomatik kontrolü başlat\n` +
      `• /now - Hemen bir kez kontrol et\n` +
      `• /stop - Kontrolü durdur\n` +
      `• /status - Mevcut durumu göster\n` +
      `• /stations - İstasyon listesi\n` +
      `• /setroute ankara istanbul - Güzergah ayarla\n` +
      `• /setdate 2025-12-30 - Tarih ayarla\n` +
      `• /setinterval 15 - Kontrol aralığı (dakika)\n\n` +
      `*Varsayılan:* ANKARA GAR → İSTANBUL(BOSTANCI), bugün, 15 dakika\n\n` +
      `Başlamak için /check yazın!`;

    await this.sendMessage(chatId, message);
  }

  private async handleCheck(chatId: string): Promise<void> {
    const state = this.getOrCreateState(chatId);

    if (state.isActive) {
      await this.sendMessage(chatId, '⚠️ Kontrol zaten aktif! Durdurmak için /stop yazın.');
      return;
    }

    state.isActive = true;
    await this.persist();

    await this.sendMessage(chatId, `✅ Koltuk kontrolü başlatıldı!\n\n` +
      `*Güzergah:* ${state.route.departure} → ${state.route.arrival}\n` +
      `*Tarih:* ${state.date}\n` +
      `*Aralık:* ${state.interval} dakika\n\n` +
      `Durdurmak için /stop yazın.`);

    this.scheduleChecks(chatId);
    await this.performCheck(chatId);
  }

  private async handleStop(chatId: string): Promise<void> {
    const state = this.state.get(chatId);

    if (!state || !state.isActive) {
      await this.sendMessage(chatId, '⚠️ Aktif kontrol bulunamadı.');
      return;
    }

    state.isActive = false;
    this.clearSchedule(chatId);
    await this.persist();

    await this.sendMessage(chatId, '🛑 Koltuk kontrolü durduruldu.');
  }

  private async handleStatus(chatId: string): Promise<void> {
    const state = this.state.get(chatId);

    if (!state) {
      await this.sendMessage(chatId, '❌ Henüz ayar yapılmamış. /start yazarak başlayın.');
      return;
    }

    const status = state.isActive ? '🟢 Aktif' : '🔴 Pasif';
    const lastCheck = state.lastCheck
      ? new Date(state.lastCheck).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
      : 'Henüz kontrol edilmedi';

    await this.sendMessage(chatId, `📊 *Bot Durumu*\n\n` +
      `*Durum:* ${status}\n` +
      `*Güzergah:* ${state.route.departure} → ${state.route.arrival}\n` +
      `*Tarih:* ${state.date}\n` +
      `*Aralık:* ${state.interval} dakika\n` +
      `*Son Kontrol:* ${lastCheck}`);
  }

  /** Tek seferlik kontrol — otomatik kontrolü etkilemez. */
  private async handleNow(chatId: string): Promise<void> {
    this.getOrCreateState(chatId);
    await this.sendMessage(chatId, '🔍 Kontrol ediliyor...');

    const found = await this.performCheck(chatId, { announceEmpty: true });
    if (!found) {
      await this.sendMessage(chatId, '😔 Şu an boş koltuk yok.');
    }
  }

  private async handleSetRoute(chatId: string, args: string[]): Promise<void> {
    if (args.length < 2) {
      await this.sendMessage(chatId, '❌ Kullanım: `/setroute ankara istanbul`\n\nİstasyonlar için /stations yazın.');
      return;
    }

    const departure = findStation(args[0]);
    const arrival = findStation(args.slice(1).join(' '));

    if (!departure || !arrival) {
      const unknown = !departure ? args[0] : args.slice(1).join(' ');
      await this.sendMessage(chatId, `❌ "${unknown}" bulunamadı.\n\nDesteklenen istasyonlar için /stations yazın.`);
      return;
    }

    if (departure.id === arrival.id) {
      await this.sendMessage(chatId, '❌ Kalkış ve varış istasyonu aynı olamaz.');
      return;
    }

    const state = this.getOrCreateState(chatId);
    state.route = {
      departure: departure.name,
      arrival: arrival.name,
      departureId: departure.id,
      arrivalId: arrival.id
    };
    state.notified = {};
    await this.persist();

    await this.sendMessage(chatId, `✅ Güzergah ayarlandı: ${departure.name} → ${arrival.name}`);
  }

  private async handleSetDate(chatId: string, args: string[]): Promise<void> {
    if (args.length < 1) {
      await this.sendMessage(chatId, '❌ Kullanım: `/setdate 2025-12-30` veya `/setdate 30-12-2025`');
      return;
    }

    const normalized = normalizeDate(args[0]);
    if (!normalized) {
      await this.sendMessage(chatId, '❌ Geçersiz tarih. Örnek: `/setdate 2025-12-30`');
      return;
    }

    if (normalized < localDate()) {
      await this.sendMessage(chatId, '❌ Geçmiş bir tarih seçilemez.');
      return;
    }

    const state = this.getOrCreateState(chatId);
    state.date = normalized;
    state.notified = {};
    await this.persist();

    await this.sendMessage(chatId, `✅ Tarih ayarlandı: ${normalized}`);
  }

  private async handleSetInterval(chatId: string, args: string[]): Promise<void> {
    const interval = parseInt(args[0], 10);

    if (isNaN(interval) || interval < 1) {
      await this.sendMessage(chatId, '❌ Geçerli bir sayı girin (minimum 1 dakika). Örnek: `/setinterval 15`');
      return;
    }

    const state = this.getOrCreateState(chatId);
    state.interval = interval;
    await this.persist();

    // Aktif kontrol varsa yeni aralıkla yeniden kur.
    if (state.isActive) {
      this.scheduleChecks(chatId);
    }

    await this.sendMessage(chatId, `✅ Kontrol aralığı ayarlandı: ${interval} dakika`);
  }

  private getOrCreateState(chatId: string): BotState {
    let state = this.state.get(chatId);

    if (!state) {
      const ankara = STATIONS.find(s => s.id === 98)!;
      const istanbul = STATIONS.find(s => s.id === 1323)!;

      state = {
        isActive: false,
        route: {
          departure: ankara.name,
          arrival: istanbul.name,
          departureId: ankara.id,
          arrivalId: istanbul.id
        },
        date: localDate(),
        interval: 15,
        lastCheck: '',
        chatId,
        notified: {}
      };
      this.state.set(chatId, state);
    }

    return state;
  }

  private clearSchedule(chatId: string): void {
    const existing = this.intervals.get(chatId);
    if (existing) {
      clearInterval(existing);
      this.intervals.delete(chatId);
    }
  }

  private scheduleChecks(chatId: string): void {
    const state = this.state.get(chatId);
    if (!state) return;

    // Çift zamanlayıcı oluşmasını engelle.
    this.clearSchedule(chatId);

    const timer = setInterval(() => {
      this.performCheck(chatId).catch(error => {
        console.error(`[${new Date().toISOString()}] Zamanlanmış kontrol hatası:`, error);
      });
    }, state.interval * 60 * 1000);

    this.intervals.set(chatId, timer);
  }

  /**
   * Bir kontrol turu yapar. Boş koltuk bulunduysa true döner.
   */
  private async performCheck(chatId: string, options: { announceEmpty?: boolean } = {}): Promise<boolean> {
    const state = this.state.get(chatId);
    if (!state) return false;

    try {
      const config: Config = {
        trainEndpoint: process.env.TCDD_ENDPOINT || process.env.TRAIN_ENDPOINT || '',
        departureStationId: state.route.departureId,
        departureStationName: state.route.departure,
        arrivalStationId: state.route.arrivalId,
        arrivalStationName: state.route.arrival,
        departureDate: state.date,
        checkStart: '00:00',
        checkEnd: '23:59',
        pollIntervalMinutes: state.interval,
        telegramBotToken: this.botToken,
        telegramChatId: chatId,
        trainAuthToken: process.env.TCDD_AUTH_TOKEN || process.env.TRAIN_AUTH_TOKEN || '',
        unitId: process.env.UNIT_ID || '',
        checkMultipleDates: false,
        maxDaysToCheck: 1
      };

      const response = await fetchSeatAvailabilityForDate(config, state.date);
      const availability = parseSeatAvailability(response, state.date);

      state.lastCheck = new Date().toISOString();

      const fresh = this.filterAlreadyNotified(state, availability.departures);

      if (fresh.length > 0) {
        const coaches = fresh.flatMap(d => d.coaches);
        await sendTelegramNotification(
          config,
          { ...availability, departures: fresh, coaches },
          coaches
        );
      }

      await this.persist();
      return availability.coaches.length > 0;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[${new Date().toISOString()}] ${chatId} için kontrol hatası:`, err.message);

      // Tekrarlayan hatalarda kullanıcıyı boğmamak için otomatik kontrolü durdur.
      if (!options.announceEmpty) {
        state.isActive = false;
        this.clearSchedule(chatId);
        await this.persist();
        await this.sendMessage(chatId,
          `❌ Kontrol durduruldu: ${err.message}\n\nDüzeltip /check ile tekrar başlatabilirsiniz.`);
      } else {
        await this.sendMessage(chatId, `❌ ${err.message}`);
      }

      return false;
    }
  }

  /**
   * Son bir saat içinde bildirilen seferleri ayıklar,
   * böylece her turda aynı mesaj tekrar gönderilmez.
   */
  private filterAlreadyNotified(state: BotState, departures: ReturnType<typeof parseSeatAvailability>['departures']) {
    const now = Date.now();
    const notified = state.notified ?? {};

    // Süresi geçmiş kayıtları temizle.
    for (const [key, timestamp] of Object.entries(notified)) {
      if (now - timestamp > NOTIFICATION_MEMORY_MS) delete notified[key];
    }

    const fresh = departures.filter(departure => {
      const key = `${state.date}-${departure.trainNumber}-${departure.departureTime}-${departure.coaches.reduce((s, c) => s + c.availableSeats, 0)}`;
      if (notified[key]) return false;
      notified[key] = now;
      return true;
    });

    state.notified = notified;
    return fresh;
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await sendTelegramMessage(this.botToken, chatId, text);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Mesaj gönderilemedi:`, error);
    }
  }
}

/**
 * `2025-12-30` veya `30-12-2025` biçimlerini `YYYY-MM-DD`'ye çevirir.
 * Geçersizse null döner.
 */
function normalizeDate(input: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  const turkish = /^(\d{2})[-.](\d{2})[-.](\d{4})$/.exec(input);

  let year: string, month: string, day: string;

  if (iso) {
    [, year, month, day] = iso;
  } else if (turkish) {
    [, day, month, year] = turkish;
  } else {
    return null;
  }

  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (isNaN(date.getTime())) return null;

  // Ay/gün taşmasını yakala (örn. 2025-02-31).
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;

  return `${year}-${month}-${day}`;
}
