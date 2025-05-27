const redis = require('redis');
const { promisify } = require('util');

console.log("Starting redis connections: ")
// Create Redis client
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error
      console.error('Redis connection refused for general client. Check if redis is running.');
      return new Error('Redis connection refused for general client');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout
      return new Error('Redis retry time exhausted for general client');
    }
    if (options.attempt > 10) {
      // End reconnecting after max attempts
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

// Handle connection events
client.on('connect', () => {
  console.log('General redis client connected to redis server');
});

client.on('error', (err) => {
  console.error('General redis client has redis error:', err);
});

// Promisify Redis commands
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);
const keysAsync = promisify(client.keys).bind(client);
const flushallAsync = promisify(client.flushall).bind(client);
const expireAsync = promisify(client.expire).bind(client);
const existsAsync = promisify(client.exists).bind(client);
const publishAsync = promisify(client.publish).bind(client);

// subscriber client
const subscriberClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // End reconnecting on a specific error
      console.error('Redis connection refused for subscriber client. Check if redis is running.');
      return new Error('Redis connection refused for subscriber client');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout
      return new Error('Redis retry time exhausted for subscriber client');
    }
    if (options.attempt > 10) {
      // End reconnecting after max attempts
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
});

// Handle connection events
subscriberClient.on('connect', () => {
  console.log('Subscriber redis client connected to redis server');
});

subscriberClient.on('error', (err) => {
  console.error('Subscriber redis client has redis error:', err);
});

module.exports = {
  client,
  getAsync,
  setAsync,
  delAsync,
  keysAsync,
  flushallAsync,
  expireAsync,
  existsAsync,
  publishAsync,
  subscriberClient: subscriberClient
};