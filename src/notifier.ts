import { Config } from './config';
import { SeatAvailability, ParsedAvailability } from './parser';

export async function sendTelegramNotification(
  config: Config,
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[]
): Promise<void> {
  const message = buildNotificationMessage(availability, newlyAvailableSeats);
  
  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text: message,
      parse_mode: 'Markdown'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Telegram API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }
}

function buildNotificationMessage(
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[]
): string {
  let message = `🚨 *Boş Koltuk Bulundu!*\n\n`;
  message += `*Tren:* ${availability.trainNumber}\n`;
  message += `*Tarih:* ${availability.date}\n`;
  message += `*Hat:* ${availability.route}\n\n`;
  
  if (newlyAvailableSeats.length === 1) {
    const coach = newlyAvailableSeats[0];
    message += `*Vagon:* ${coach.coachName}\n`;
    message += `*Boş Koltuk:* ${coach.availableSeats}`;
  } else {
    message += `*Yeni Boş Koltuklar:*\n`;
    newlyAvailableSeats.forEach(coach => {
      message += `• *${coach.coachName}:* ${coach.availableSeats} koltuk\n`;
    });
  }
  
  return message;
}