const { getAsync, setAsync, delAsync, keysAsync } = require('./redis');
const AppError = require('../util/appError');

/**
 * A wrapper function that implements caching logic for database operations
 * Similar to the transactional wrapper, but for caching data
 * 
 * @param {Function} callback - The operation to perform, potentially using cached data
 * @param {string} key - The cache key to use
 * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
 * @param {boolean} forceRefresh - Force refresh the cache (default: false)
 * @returns {Promise<any>} - The result of the operation or cached data
 */
async function cached(callback, key, ttl = 3600, forceRefresh = false) {
  try {
    // If forceRefresh is not set, try to get data from cache
    if (!forceRefresh) {
      const cachedData = await getAsync(key);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    }

    // If we get here, either the cache is empty or forceRefresh is true
    const result = await callback();

    // Cache the result for future use
    if (result) {
      await setAsync(key, JSON.stringify(result), 'EX', ttl);
    }

    return result;
  } catch (error) {
    console.error('Error in cached operation:', error);
    throw new AppError(error.message || 'Error performing cached operation', 
                       error.status || 500);
  }
}

/**
 * Invalidate cache keys based on a pattern
 * 
 * @param {string} pattern - The pattern to match cache keys (e.g., 'problem:*')
 * @returns {Promise<number>} - Number of keys invalidated
 */
async function invalidateCache(pattern) {
  try {
    // Get all keys matching the pattern
    const keys = await keysAsync(pattern);
    
    if (keys && keys.length > 0) {
      // Delete all matching keys
      await delAsync(keys);
      return keys.length;
    }
    
    return 0;
  } catch (error) {
    console.error('Error invalidating cache:', error);
    throw new AppError('Error invalidating cache', 500);
  }
}

/**
 * Generate a cache key with namespace and id
 * 
 * @param {string} namespace - The namespace (e.g., 'problem', 'onlineTest')
 * @param {string|number} id - The entity ID
 * @param {string} suffix - Optional suffix for the key
 * @returns {string} - The generated cache key
 */
function generateCacheKey(namespace, id, suffix = '') {
  return `${namespace}:${id}${suffix ? `:${suffix}` : ''}`;
}

module.exports = {
  cached,
  invalidateCache,
  generateCacheKey
};