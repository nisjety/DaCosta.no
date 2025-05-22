// MongoDB initialization script
// This script is executed when the MongoDB container is created
// It creates the database, collections, and indexes

db = db.getSiblingDB('domain_monitor');

// Create collections
db.createCollection('domains');
db.createCollection('notifications');
db.createCollection('monitoring_logs');

// Create indexes
db.domains.createIndex({ name: 1 }, { unique: true });
db.domains.createIndex({ isActive: 1 });
db.domains.createIndex({ 'lastStatus.isRegistered': 1 });
db.domains.createIndex({ lastChecked: 1 });

db.notifications.createIndex({ timestamp: 1 });
db.notifications.createIndex({ 'data.domain': 1 });

db.monitoring_logs.createIndex({ timestamp: 1 });
db.monitoring_logs.createIndex({ success: 1 });

// Insert some initial data if the collection is empty
if (db.domains.countDocuments() === 0) {
  db.domains.insertMany([
    {
      name: 'example.com',
      preferredRegistrar: 'GoDaddy',
      isActive: true,
      lastChecked: new Date(),
      lastStatus: {
        isWebsiteUp: true,
        isRegistered: true,
        registrar: 'GoDaddy',
        statusDescription: 'active',
        timestamp: new Date()
      },
      history: []
    },
    {
      name: 'example.org',
      preferredRegistrar: 'Namecheap',
      isActive: true,
      lastChecked: new Date(),
      lastStatus: {
        isWebsiteUp: true,
        isRegistered: true,
        registrar: 'Namecheap',
        statusDescription: 'active',
        timestamp: new Date()
      },
      history: []
    }
  ]);
  
  print('Added sample domains to database');
}

print('MongoDB initialization completed');