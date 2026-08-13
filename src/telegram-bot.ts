import { promises as fs } from 'fs';
import path from 'path';
import { Config, localDate, localTime, generateDateRange } from './config';
import { fetchSeatAvailabilityForDate, fetchSeatAvailabilityForMultipleDates } from './fetcher';
import { parseSeatAvailability, Departure } from './parser';
import { sendTelegramNotification, sendTelegramMessage, sendTelegramSetMyCommands } from './notifier';
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
  /** true ise bugünden itibaren `days` gün taranır; false ise sadece `date`. */
  multiDate?: boolean;
  /** Çoklu tarih modunda taranacak gün sayısı. */
  days?: number;
  /** Kontrolün yapılacağı saat aralığı (Türkiye saati, HH:MM). */
  checkStart?: string;
  checkEnd?: string;
  /** Daha önce bildirilen seferler: key -> bildirim zamanı (ms). */
  notified?: Record<string, number>;
}

/** Bir sohbetin varsayılan ayarları. */
const DEFAULTS = {
  interval: 15,
  multiDate: false,
  days: 7,
  checkStart: '00:00',
  checkEnd: '23:59'
};

export class TelegramBot {
  private botToken: string;
  private state: Map<string, BotState> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Telegram'ın komut menüsünü ayarlar; kullanıcı `/` yazınca komutlar
   * açıklamalarıyla listelenir. Başarısızlık kritik değildir.
   */
  async registerCommands(): Promise<void> {
    const commands = [
      { command: 'check', description: 'Otomatik kontrolü başlat' },
      { command: 'now', description: 'Hemen bir kez kontrol et' },
      { command: 'stop', description: 'Otomatik kontrolü durdur' },
      { command: 'status', description: 'Mevcut ayarları göster' },
      { command: 'setroute', description: 'Güzergah ayarla (örn: ankara istanbul)' },
      { command: 'swap', description: 'Kalkış ↔ varış yönünü ters çevir' },
      { command: 'setdate', description: 'Aranacak tarihi ayarla' },
      { command: 'multi', description: 'Çoklu tarih modu (örn: 7 gün)' },
      { command: 'stations', description: 'Desteklenen istasyonlar' },
      { command: 'setinterval', description: 'Kontrol aralığı (dakika)' },
      { command: 'settime', description: 'Bildirim saat aralığı' },
      { command: 'reset', description: 'Ayarları varsayılana döndür' },
      { command: 'help', description: 'Yardım ve komut listesi' }
    ];

    try {
      await sendTelegramSetMyCommands(this.botToken, commands);
      console.log(`[${new Date().toISOString()}] Telegram komut menüsü kuruldu (${commands.length} komut)`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Komut menüsü kurulamadı:`, error);
    }
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
        case '/swap':
          await this.handleSwap(chatId);
          break;
        case '/setdate':
          await this.handleSetDate(chatId, args);
          break;
        case '/setinterval':
          await this.handleSetInterval(chatId, args);
          break;
        case '/multi':
          await this.handleMulti(chatId, args);
          break;
        case '/settime':
          await this.handleSetTime(chatId, args);
          break;
        case '/reset':
          await this.handleReset(chatId);
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
      `Belirlediğin güzergah ve tarihte boş koltuk çıkınca sana haber verir.\n\n` +
      `🎮 *Kontrol*\n` +
      `• /check — Otomatik kontrolü başlat (aralıklarla tarar)\n` +
      `• /now — Beklemeden hemen bir kez kontrol et\n` +
      `• /stop — Otomatik kontrolü durdur\n` +
      `• /status — Mevcut ayarları ve son kontrolü göster\n\n` +
      `🗺 *Güzergah & Tarih*\n` +
      `• /setroute ankara istanbul — Güzergah ayarla\n` +
      `• /swap — Kalkış ↔ varış yönünü ters çevir\n` +
      `• /setdate 2025-12-30 — Aranacak tarihi ayarla\n` +
      `• /multi 7 — Bugünden itibaren 7 gün tara (0 = kapat)\n` +
      `• /stations — Desteklenen istasyonları listele\n\n` +
      `⚙️ *Ayarlar*\n` +
      `• /setinterval 15 — Kontrol aralığı (dakika)\n` +
      `• /settime 08:00 22:00 — Sadece bu saatler arası bildir\n` +
      `• /reset — Tüm ayarları varsayılana döndür\n\n` +
      `_Varsayılan:_ ANKARA GAR → İSTANBUL(BOSTANCI), bugün, 15 dk\n\n` +
      `Başlamak için /check yaz!`;

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

    const dateLine = state.multiDate
      ? `Bugünden itibaren ${state.days ?? DEFAULTS.days} gün`
      : state.date;
    const timeLine = `${state.checkStart ?? DEFAULTS.checkStart} - ${state.checkEnd ?? DEFAULTS.checkEnd}`;

    await this.sendMessage(chatId, `📊 *Bot Durumu*\n\n` +
      `*Durum:* ${status}\n` +
      `*Güzergah:* ${state.route.departure} → ${state.route.arrival}\n` +
      `*Tarih:* ${dateLine}\n` +
      `*Aralık:* ${state.interval} dakika\n` +
      `*Bildirim saatleri:* ${timeLine}\n` +
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

  /** Kalkış ↔ varış istasyonlarını yer değiştirir. */
  private async handleSwap(chatId: string): Promise<void> {
    const state = this.getOrCreateState(chatId);
    const { departure, arrival, departureId, arrivalId } = state.route;

    state.route = {
      departure: arrival,
      arrival: departure,
      departureId: arrivalId,
      arrivalId: departureId
    };
    state.notified = {};
    await this.persist();

    await this.sendMessage(chatId, `🔄 Güzergah ters çevrildi: ${arrival} → ${departure}`);
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
    state.multiDate = false; // tek tarih seçildi, çoklu modu kapat
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

  /** Çoklu tarih modu: bugünden itibaren N gün tara. `0` kapatır. */
  private async handleMulti(chatId: string, args: string[]): Promise<void> {
    const days = parseInt(args[0], 10);

    if (isNaN(days) || days < 0 || days > 30) {
      await this.sendMessage(chatId, '❌ Kullanım: `/multi 7` (0-30 gün, 0 = kapat)');
      return;
    }

    const state = this.getOrCreateState(chatId);

    if (days === 0) {
      state.multiDate = false;
      state.notified = {};
      await this.persist();
      await this.sendMessage(chatId, `✅ Çoklu tarih modu kapatıldı. Tek tarih: ${state.date}`);
      return;
    }

    state.multiDate = true;
    state.days = days;
    state.notified = {};
    await this.persist();

    await this.sendMessage(chatId, `✅ Çoklu tarih modu açık: bugünden itibaren ${days} gün taranacak.`);
  }

  /** Bildirim yapılacak saat aralığını ayarlar. */
  private async handleSetTime(chatId: string, args: string[]): Promise<void> {
    if (args.length < 2 || !isValidTime(args[0]) || !isValidTime(args[1])) {
      await this.sendMessage(chatId, '❌ Kullanım: `/settime 08:00 22:00` (24 saat biçimi)');
      return;
    }

    if (args[0] >= args[1]) {
      await this.sendMessage(chatId, '❌ Başlangıç saati bitiş saatinden önce olmalı.');
      return;
    }

    const state = this.getOrCreateState(chatId);
    state.checkStart = args[0];
    state.checkEnd = args[1];
    await this.persist();

    await this.sendMessage(chatId, `✅ Bildirim saatleri: ${args[0]} - ${args[1]}`);
  }

  /** Tüm ayarları varsayılana döndürür (aktif kontrolü de durdurur). */
  private async handleReset(chatId: string): Promise<void> {
    this.clearSchedule(chatId);
    this.state.delete(chatId);
    const state = this.getOrCreateState(chatId); // taze varsayılan
    await this.persist();

    await this.sendMessage(chatId,
      `♻️ Ayarlar sıfırlandı.\n\n` +
      `*Güzergah:* ${state.route.departure} → ${state.route.arrival}\n` +
      `*Tarih:* ${state.date}\n` +
      `*Aralık:* ${state.interval} dakika`);
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
        interval: DEFAULTS.interval,
        lastCheck: '',
        chatId,
        multiDate: DEFAULTS.multiDate,
        days: DEFAULTS.days,
        checkStart: DEFAULTS.checkStart,
        checkEnd: DEFAULTS.checkEnd,
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

    // Zamanlanmış kontroller saat aralığının dışındaysa atlanır.
    // (/now ile gelen elle kontroller bu kısıttan muaftır.)
    const start = state.checkStart ?? DEFAULTS.checkStart;
    const end = state.checkEnd ?? DEFAULTS.checkEnd;
    if (!options.announceEmpty) {
      const now = localTime();
      if (now < start || now > end) {
        console.log(`[${new Date().toISOString()}] ${chatId}: ${now} bildirim saatleri (${start}-${end}) dışında, atlandı`);
        return false;
      }
    }

    try {
      const config: Config = {
        trainEndpoint: process.env.TCDD_ENDPOINT || process.env.TRAIN_ENDPOINT || '',
        departureStationId: state.route.departureId,
        departureStationName: state.route.departure,
        arrivalStationId: state.route.arrivalId,
        arrivalStationName: state.route.arrival,
        departureDate: state.date,
        checkStart: start,
        checkEnd: end,
        pollIntervalMinutes: state.interval,
        telegramBotToken: this.botToken,
        telegramChatId: chatId,
        trainAuthToken: process.env.TCDD_AUTH_TOKEN || process.env.TRAIN_AUTH_TOKEN || '',
        unitId: process.env.UNIT_ID || '',
        checkMultipleDates: !!state.multiDate,
        maxDaysToCheck: state.days ?? DEFAULTS.days
      };

      // Çoklu tarih modunda bugünden itibaren birden fazla gün taranır.
      const dates = state.multiDate ? generateDateRange(config) : [state.date];
      const { results } = await fetchSeatAvailabilityForMultipleDates(config, dates);

      state.lastCheck = new Date().toISOString();

      let anySeats = false;
      const freshAll: Departure[] = [];
      let notifyDate = state.date;

      for (const { date, response } of results) {
        const availability = parseSeatAvailability(response, date);
        if (availability.coaches.length > 0) anySeats = true;

        const fresh = this.filterAlreadyNotified(state, availability.departures, date);
        if (fresh.length > 0) {
          freshAll.push(...fresh);
          notifyDate = date;
        }
      }

      if (freshAll.length > 0) {
        const coaches = freshAll.flatMap(d => d.coaches);
        await sendTelegramNotification(
          config,
          { trainNumber: '', date: notifyDate, route: '', coaches, hasAvailableSeats: true, departures: freshAll },
          coaches
        );
      }

      await this.persist();
      return anySeats;

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
  private filterAlreadyNotified(state: BotState, departures: Departure[], date: string) {
    const now = Date.now();
    const notified = state.notified ?? {};

    // Süresi geçmiş kayıtları temizle.
    for (const [key, timestamp] of Object.entries(notified)) {
      if (now - timestamp > NOTIFICATION_MEMORY_MS) delete notified[key];
    }

    const fresh = departures.filter(departure => {
      const key = `${date}-${departure.trainNumber}-${departure.departureTime}-${departure.coaches.reduce((s, c) => s + c.availableSeats, 0)}`;
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

/** `HH:MM` biçimini (00:00 - 23:59) doğrular. */
function isValidTime(input: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(input);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}
