import { Config } from './config';
import { SeatAvailability, ParsedAvailability } from './parser';
import axios from 'axios';

/**
 * Telegram'a ham mesaj gönderir.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    }, { timeout: 15000 });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] Error sending Telegram notification:`, error.response?.status, error.response?.data);
      throw new Error(`Telegram API error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    }
    console.error(`[${new Date().toISOString()}] Error sending Telegram notification:`, error);
    throw error;
  }
}

/**
 * Telegram'ın komut menüsünü ayarlar (kullanıcı `/` yazınca görünür).
 */
export async function sendTelegramSetMyCommands(
  botToken: string,
  commands: Array<{ command: string; description: string }>
): Promise<void> {
  await axios.post(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    commands
  }, { timeout: 15000 });
}

export async function sendTelegramNotification(
  config: Config,
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[]
): Promise<void> {
  const message = buildNotificationMessage(availability, newlyAvailableSeats, config);

  console.log(`[${new Date().toISOString()}] Sending Telegram notification for ${newlyAvailableSeats.length} newly available coaches`);

  await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);

  console.log(`[${new Date().toISOString()}] Telegram notification sent successfully`);
}

/**
 * Çalıştırma sırasında oluşan hatayı Telegram'a bildirir.
 * Bildirim hatası ana akışı durdurmaz.
 */
export async function sendErrorNotification(
  config: Config,
  error: Error
): Promise<void> {
  const message =
    `❌ *Kontrol Başarısız*\n\n` +
    `${escapeMarkdown(error.message)}\n\n` +
    `_${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}_`;

  try {
    await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);
  } catch (sendError) {
    console.error(`[${new Date().toISOString()}] Hata bildirimi gönderilemedi:`, sendError);
  }
}

/**
 * Kısmi başarısızlık uyarısını Telegram'a gönderir (bazı tarihler sorgulanamadı,
 * ama en az biri başarılı oldu). Bildirim hatası ana akışı durdurmaz.
 */
export async function sendWarningNotification(
  config: Config,
  title: string,
  detail: string
): Promise<void> {
  const message =
    `⚠️ *${escapeMarkdown(title)}*\n\n` +
    `${escapeMarkdown(detail)}\n\n` +
    `_${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}_`;

  try {
    await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message);
  } catch (sendError) {
    console.error(`[${new Date().toISOString()}] Uyarı bildirimi gönderilemedi:`, sendError);
  }
}

function buildNotificationMessage(
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[],
  config: Config
): string {
  const escapedDate = escapeMarkdown(availability.date);
  const escapedDepartureStation = escapeMarkdown(config.departureStationName);
  const escapedArrivalStation = escapeMarkdown(config.arrivalStationName);

  let message = `🚨 *Boş Koltuk Bulundu!*\n\n`;
  message += `*Tarih:* ${escapedDate}\n`;
  message += `*Güzergah:* ${escapedDepartureStation} → ${escapedArrivalStation}\n\n`;

  if (availability.departures && availability.departures.length > 0) {
    message += `*Müsait Seferler:*\n\n`;
    
    availability.departures.forEach((departure, index) => {
      const escapedTrainNumber = escapeMarkdown(departure.trainNumber);
      const escapedTime = escapeMarkdown(departure.departureTime);
      
      message += `*${index + 1}. Tren ${escapedTrainNumber} - ${escapedTime}*\n`;
      
      // Bu seferdeki vagonları listele
      departure.coaches.forEach(coach => {
        const escapedCoachName = escapeMarkdown(coach.coachName);
        message += `  • ${escapedCoachName}: ${coach.availableSeats} koltuk\n`;
        
        // Cabin class detaylarını göster
        if (coach.cabinClasses && coach.cabinClasses.length > 0) {
          coach.cabinClasses.forEach(cabinClass => {
            const escapedCabinName = escapeMarkdown(cabinClass.name);
            message += `    - ${escapedCabinName}: ${cabinClass.seats} koltuk\n`;
          });
        }
      });
      
      message += `\n`;
    });
    
    // TCDD bilet satın alma linkini ekle
    const bookingUrl = `https://ebilet.tcddtasimacilik.gov.tr/tr/tren-seferleri?from=${config.departureStationId}&to=${config.arrivalStationId}&date=${availability.date}`;
    message += `*Bilet Satın Al:* [TCDD E-Bilet](${bookingUrl})\n`;
  } else {
    // Fallback: Eski format
    if (newlyAvailableSeats.length === 1) {
      const coach = newlyAvailableSeats[0];
      message += `*Vagon:* ${escapeMarkdown(coach.coachName)}\n`;
      message += `*Boş Koltuk:* ${coach.availableSeats}`;
    } else {
      message += `*Yeni Boş Koltuklar:*\n`;
      newlyAvailableSeats.forEach(coach => {
        message += `• *${escapeMarkdown(coach.coachName)}:* ${coach.availableSeats} koltuk\n`;
      });
    }
  }

  return message;
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`');
}