# Train Ticket Checker

A Node.js application that automatically checks train seat availability and sends Telegram notifications when seats become available.

## Features

- 🚂 Automatic seat availability checking
- 📱 Telegram notifications for newly available seats
- ⏰ Time-based checking (only during specified hours)
- 📅 Multiple date range checking
- 🔄 GitHub Actions integration for automated checking
- 📊 State persistence with JSON file
- 🛡️ Production-ready with TypeScript

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd train-ticket-checker
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Train API Configuration
TCDD_ENDPOINT=https://web-api-prod-ytp.tcddtasimacilik.gov.tr/tms/train/train-availability?environment=dev&userId=1
DEPARTURE_STATION_ID=1323
DEPARTURE_STATION_NAME=İSTANBUL(BOSTANCI)
ARRIVAL_STATION_ID=98
ARRIVAL_STATION_NAME=ANKARA GAR
DEPARTURE_DATE=27-10-2025 21:00:00

# Train Authentication
TCDD_AUTH_TOKEN=your_train_auth_token_here
UNIT_ID=3895

# Time Configuration (24-hour format)
CHECK_START=07:00
CHECK_END=22:00
POLL_INTERVAL_MINUTES=15

# Multiple Date Configuration
CHECK_MULTIPLE_DATES=true
MAX_DAYS_TO_CHECK=7

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

### 3. Get Train Authentication Token

**IMPORTANT**: You need to get a fresh train authentication token from the browser:

1. Go to [https://ebilet.tcddtasimacilik.gov.tr](https://ebilet.tcddtasimacilik.gov.tr)
2. Open Developer Tools (F12)
3. Go to Network tab
4. Search for any train (any route, any date)
5. Find the `train-availability` request
6. Copy the `Authorization` header value (starts with `eyJ...`)
7. This token expires after a few hours, so you'll need to refresh it periodically

### 4. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token to your `.env` file
5. To get your chat ID:
   - Send a message to your bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response

### 5. Run Locally

```bash
# Build the application
npm run build

# Run once
npm start

# Run continuously (for development)
npm run dev -- --continuous
```

## GitHub Actions Setup

### 1. Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add these secrets:

- `TCDD_ENDPOINT`: Train API endpoint
- `DEPARTURE_STATION_ID`: Departure station ID
- `DEPARTURE_STATION_NAME`: Departure station name
- `ARRIVAL_STATION_ID`: Arrival station ID
- `ARRIVAL_STATION_NAME`: Arrival station name
- `DEPARTURE_DATE`: Travel date and time (DD-MM-YYYY HH:MM:SS)
- `TCDD_AUTH_TOKEN`: Train authentication token
- `UNIT_ID`: Train unit ID
- `CHECK_START`: Start time for checking (HH:MM)
- `CHECK_END`: End time for checking (HH:MM)
- `POLL_INTERVAL_MINUTES`: Check interval in minutes
- `CHECK_MULTIPLE_DATES`: Check multiple dates (true/false)
- `MAX_DAYS_TO_CHECK`: Maximum days to check ahead
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_CHAT_ID`: Your Telegram chat ID

### 2. Workflow

The GitHub Actions workflow runs automatically every 15 minutes and will:
- Check seat availability during specified hours
- Send Telegram notifications for newly available seats
- Persist state between runs

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TCDD_ENDPOINT` | Train API endpoint | `https://web-api-prod-ytp.tcddtasimacilik.gov.tr/tms/train/train-availability?environment=dev&userId=1` |
| `DEPARTURE_STATION_ID` | Departure station ID | `1323` |
| `DEPARTURE_STATION_NAME` | Departure station name | `İSTANBUL(BOSTANCI)` |
| `ARRIVAL_STATION_ID` | Arrival station ID | `98` |
| `ARRIVAL_STATION_NAME` | Arrival station name | `ANKARA GAR` |
| `DEPARTURE_DATE` | Travel date and time | `27-10-2025 21:00:00` |
| `TCDD_AUTH_TOKEN` | Train authentication token | `eyJhbGciOiJSUzI1NiIs...` |
| `UNIT_ID` | Train unit ID | `3895` |
| `CHECK_START` | Start checking time (24h format) | `07:00` |
| `CHECK_END` | End checking time (24h format) | `22:00` |
| `POLL_INTERVAL_MINUTES` | Check interval in minutes | `15` |
| `CHECK_MULTIPLE_DATES` | Check multiple dates (true/false) | `true` |
| `MAX_DAYS_TO_CHECK` | Maximum days to check ahead | `7` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | `123456789:ABC...` |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | `123456789` |

## Project Structure

```
.
├── src/
│   ├── index.ts          # Main entry point
│   ├── config.ts         # Environment configuration
│   ├── fetcher.ts        # Train API calls
│   ├── parser.ts         # Response parsing
│   ├── notifier.ts       # Telegram notifications
│   ├── state.ts          # State management
│   └── auth.ts           # Authentication handling
├── .github/workflows/
│   └── check-seats.yml   # GitHub Actions workflow
├── package.json
├── tsconfig.json
├── env.example
└── README.md
```

## Notification Format

When seats become available, you'll receive a Telegram message like:

```
🚨 Boş Koltuk Bulundu!

Tren: 12345
Tarih: 2025-10-30
Hat: ANK → ESK
Vagon: B1
Boş Koltuk: 5
```

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the application once
- `npm run dev` - Build and run in continuous mode

### Local Development

For local development, use the continuous mode:

```bash
npm run dev -- --continuous
```

This will check for seats every `POLL_INTERVAL_MINUTES` minutes during the specified time window.

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure all required variables are set in your `.env` file
   - Check the `env.example` file for the complete list

2. **"Telegram API error"**
   - Verify your bot token is correct
   - Ensure you've sent at least one message to your bot
   - Check that the chat ID is correct

3. **"HTTP 404" from Train API**
   - Verify the API endpoint URL is correct
   - Check that the train number, stations, and date are valid

4. **No notifications received**
   - Check that the current time is within `CHECK_START` and `CHECK_END`
   - Verify the Telegram bot is working by sending a test message
   - Check the GitHub Actions logs for errors

## License

MIT License - feel free to use and modify as needed.