import { Config } from './config';
import { SeatAvailability, ParsedAvailability } from './parser';

/**
 * Sends a Telegram notification about newly available seats
 */
export async function sendTelegramNotification(
  config: Config,
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[]
): Promise<void> {
  const message = buildNotificationMessage(availability, newlyAvailableSeats);
  
  console.log(`[${new Date().toISOString()}] Sending Telegram notification for ${newlyAvailableSeats.length} newly available coaches`);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    console.log(`[${new Date().toISOString()}] Telegram notification sent successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error sending Telegram notification:`, error);
    throw error;
  }
}

/**
 * Builds the notification message with proper Markdown escaping
 */
function buildNotificationMessage(
  availability: ParsedAvailability,
  newlyAvailableSeats: SeatAvailability[]
): string {
  const escapedTrainNumber = escapeMarkdown(availability.trainNumber);
  const escapedDate = escapeMarkdown(availability.date);
  const escapedRoute = escapeMarkdown(availability.route);
  
  let message = `🚨 *Boş Koltuk Bulundu\\!*\n\n`;
  message += `*Tren:* ${escapedTrainNumber}\n`;
  message += `*Tarih:* ${escapedDate}\n`;
  message += `*Hat:* ${escapedRoute}\n\n`;
  
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
  
  return message;
}

/**
 * Escapes special characters for Markdown formatting
 */
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
