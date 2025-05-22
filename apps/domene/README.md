# Domain Monitor

A robust service that monitors domain availability and sends notifications when domains become available for purchase, with a real-time dashboard.

## Features

- 📊 **Domain Status Tracking**: Monitors the status of domains you're interested in acquiring.
- 🔍 **Multi-level Checks**: Uses both HTTP availability and WHOIS registration data.
- 📱 **SMS Notifications**: Sends alerts via Twilio SMS when domains become available.
- 🔄 **Scheduled Monitoring**: Configurable checking intervals with cron-like scheduling.
- 📈 **Status History**: Keeps track of domain status changes over time.
- 🔗 **Purchase Links**: Provides direct links to your preferred domain registrars.
- 🖥️ **Real-time Dashboard**: Web-based UI with WebSocket updates for live monitoring.

## Architecture

This project follows the SOLID principles:

- **Single Responsibility Principle**: Each class has only one reason to change.
- **Open/Closed Principle**: Code is open for extension but closed for modification.
- **Liskov Substitution Principle**: Derived classes can substitute their base classes.
- **Interface Segregation Principle**: Clients aren't forced to depend on methods they don't use.
- **Dependency Inversion Principle**: Dependencies are based on abstractions, not concretions.

## Project Structure

```
domain-monitor/
├── src/
│   ├── config/         # Configuration
│   ├── models/         # Domain and data models
│   ├── services/       # Core services
│   ├── providers/      # External service providers
│   ├── repositories/   # Data storage and retrieval
│   ├── utils/          # Utility functions
│   └── server.js       # Static file server
├── public/             # Frontend dashboard files
├── data/               # Stored domain data (created at runtime)
└── .env                # Environment configuration (create from .env.example)
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/domain-monitor.git
   cd domain-monitor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create an environment configuration file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your configuration values:
   - Twilio credentials for SMS notifications
   - Monitoring schedule and intervals
   - API and WebSocket ports
   - Log level and other options

5. Create the public directory for the dashboard:
   ```bash
   mkdir -p public
   ```

6. Copy the frontend dashboard file to the public directory:
   ```bash
   cp frontend/index.html public/
   ```

## Usage

### Running the Service

Start the monitoring service and web dashboard:

```bash
npm start
```

For development with auto-reload on changes:

```bash
npm run dev
```

### Accessing the Dashboard

Open your browser and navigate to:

```
http://localhost:3000
```

The dashboard provides:
- Real-time monitoring of domain status
- Add/remove domains to track
- Manual checks and scheduler control
- Notification history
- Live event logs via WebSocket

```javascript
// Example code to add a domain programmatically
const { initialize } = require('./src/index');

async function addDomain() {
  const { domainService } = await initialize();
  await domainService.addDomain('example.com', 'GoDaddy');
  console.log('Domain added successfully');
}

addDomain();
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `MONITORING_SCHEDULE` | Cron schedule for checks | `0 * * * *` (hourly) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | |
| `RECIPIENT_PHONE_NUMBER` | Comma-separated recipient numbers | |
| `LOG_LEVEL` | Logging level (error/warn/info/debug) | `info` |

## Extending the Service

### Adding a New Notification Provider

1. Create a new provider in `src/providers/notification/`:
   ```javascript
   const NotificationProvider = require('./NotificationProvider');
   
   class EmailProvider extends NotificationProvider {
     async sendNotification(message, data = {}) {
       // Implementation for sending email notifications
     }
   }
   
   module.exports = EmailProvider;
   ```

2. Add the provider in `src/index.js`:
   ```javascript
   const emailProvider = new EmailProvider(config);
   monitorService.addNotificationProvider(emailProvider);
   ```

### Adding a New Registrar

Edit `src/config/registrars.js` to add a new domain registrar:

```javascript
const registrarLinks = {
  // Existing registrars...
  
  // Add your new registrar
  MyRegistrar: (domain) => `https://myregistrar.com/search?domain=${domain}`
};
```

## License

MIT