import { Config } from './config';
import { SeatAvailability, ParsedAvailability } from './parser';
import axios from 'axios';

export async function sendTelegramNotification(
  config: Config,
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[]
): Promise<void> {
  const message = buildNotificationMessage(availability, newlyAvailableSeats, config);

  console.log(`[${new Date().toISOString()}] Sending Telegram notification for ${newlyAvailableSeats.length} newly available coaches`);

  try {
    const response = await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: message,
      parse_mode: 'Markdown'
    });

    console.log(`[${new Date().toISOString()}] Telegram notification sent successfully`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] Error sending Telegram notification:`, error.response?.status, error.response?.data);
      throw new Error(`Telegram API error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    } else {
      console.error(`[${new Date().toISOString()}] Error sending Telegram notification:`, error);
      throw error;
    }
  }
}

function buildNotificationMessage(
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[],
  config: Config
): string {
  const escapedTrainNumber = escapeMarkdown(availability.trainNumber);
  const escapedDate = escapeMarkdown(availability.date);
  const escapedRoute = escapeMarkdown(availability.route);
  const escapedDepartureStation = escapeMarkdown(config.departureStationName);
  const escapedArrivalStation = escapeMarkdown(config.arrivalStationName);
  
  // Kalkış saatini config'den al
  const departureTime = config.departureDate.split(' ')[1] || '21:00:00';
  const timeOnly = departureTime.split(':').slice(0, 2).join(':');

  let message = `🚨 *Boş Koltuk Bulundu\\!*\n\n`;
  message += `*Tren:* ${escapedTrainNumber}\n`;
  message += `*Tarih:* ${escapedDate}\n`;
  message += `*Kalkış Saati:* ${timeOnly}\n`;
  message += `*Güzergah:* ${escapedDepartureStation} → ${escapedArrivalStation}\n\n`;

  if (newlyAvailableSeats.length === 1) {
    const coach = newlyAvailableSeats[0];
    message += `*Vagon:* ${escapeMarkdown(coach.coachName)}\n`;
    message += `*Boş Koltuk:* ${coach.availableSeats}`;
  } else {
    // Vagonları grupla ve tekrarları önle
    const uniqueCoaches = new Map<string, number>();
    newlyAvailableSeats.forEach(coach => {
      const existing = uniqueCoaches.get(coach.coachName) || 0;
      uniqueCoaches.set(coach.coachName, existing + coach.availableSeats);
    });

    message += `*Yeni Boş Koltuklar:*\n`;
    uniqueCoaches.forEach((totalSeats, coachName) => {
      message += `• *${escapeMarkdown(coachName)}:* ${totalSeats} koltuk\n`;
    });
  }

  return message;
}

function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}