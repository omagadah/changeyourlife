/**
 * Gestionnaire réseau avec retry automatique et gestion des erreurs
 */

import { appConfig } from './config.js';
import { logger } from './logger.js';

/**
 * Classe pour les erreurs réseau
 */
export class NetworkError extends Error {
  constructor(message, code = null, originalError = null) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Classe pour les erreurs de timeout
 */
export class TimeoutError extends NetworkError {
  constructor(message = 'Request timeout') {
    super(message, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

/**
 * Classe pour les erreurs de validation
 */
export class ValidationError extends NetworkError {
  constructor(message, errors = []) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Effectuer une requête avec retry automatique
 */
export async function fetchWithRetry(
  url,
  options = {},
  maxRetries = appConfig.maxRetries,
  retryDelay = appConfig.retryDelay
) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Fetch attempt ${attempt + 1}/${maxRetries + 1}`, { url });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), appConfig.requestTimeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          `HTTP_${response.status}`
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      if (error.name === 'AbortError') {
        lastError = new TimeoutError(`Request timeout after ${appConfig.requestTimeout}ms`);
      }

      logger.warn(`Fetch failed (attempt ${attempt + 1})`, {
        url,
        error: error.message,
        willRetry: attempt < maxRetries
      });

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('Fetch failed after all retries', lastError, { url, maxRetries });
  throw lastError;
}

/**
 * Effectuer une requête JSON avec retry
 */
export async function fetchJSON(
  url,
  options = {},
  maxRetries = appConfig.maxRetries
) {
  try {
    const response = await fetchWithRetry(url, options, maxRetries);
    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Fetch JSON failed', error, { url });
    throw error;
  }
}

/**
 * Effectuer une requête POST avec retry
 */
export async function fetchPost(
  url,
  data = {},
  options = {},
  maxRetries = appConfig.maxRetries
) {
  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(data),
        ...options
      },
      maxRetries
    );

    const result = await response.json();
    return result;
  } catch (error) {
    logger.error('POST request failed', error, { url });
    throw error;
  }
}

/**
 * Vérifier la connectivité réseau
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Attendre la connectivité réseau
 */
export async function waitForOnline(timeout = 30000) {
  if (isOnline()) return true;

  return new Promise((resolve) => {
    const handleOnline = () => {
      window.removeEventListener('online', handleOnline);
      clearTimeout(timeoutId);
      resolve(true);
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', handleOnline);
      resolve(false);
    }, timeout);

    window.addEventListener('online', handleOnline);
  });
}

/**
 * Effectuer une opération avec fallback offline
 */
export async function withOfflineFallback(
  onlineOperation,
  offlineOperation = null
) {
  try {
    if (!isOnline()) {
      logger.warn('Offline mode - using fallback');
      if (offlineOperation) {
        return await offlineOperation();
      }
      throw new NetworkError('No internet connection', 'OFFLINE');
    }

    return await onlineOperation();
  } catch (error) {
    logger.error('Online operation failed', error);

    if (offlineOperation) {
      logger.info('Falling back to offline operation');
      return await offlineOperation();
    }

    throw error;
  }
}

/**
 * Effectuer une opération avec retry et fallback
 */
export async function withRetryAndFallback(
  operation,
  fallback = null,
  maxRetries = appConfig.maxRetries
) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Operation attempt ${attempt + 1}/${maxRetries + 1}`);
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(`Operation failed (attempt ${attempt + 1})`, {
        error: error.message,
        willRetry: attempt < maxRetries
      });

      if (attempt < maxRetries) {
        const delay = appConfig.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (fallback) {
    logger.info('Using fallback after all retries failed');
    return await fallback();
  }

  logger.error('Operation failed after all retries', lastError);
  throw lastError;
}

/**
 * Effectuer une opération avec timeout
 */
export async function withTimeout(
  operation,
  timeout = appConfig.requestTimeout
) {
  return Promise.race([
    operation(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new TimeoutError()), timeout)
    )
  ]);
}

/**
 * Effectuer une opération avec retry et timeout
 */
export async function withRetryAndTimeout(
  operation,
  maxRetries = appConfig.maxRetries,
  timeout = appConfig.requestTimeout
) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(operation, timeout);
    } catch (error) {
      lastError = error;
      logger.warn(`Operation timeout/failed (attempt ${attempt + 1})`, {
        error: error.message,
        willRetry: attempt < maxRetries
      });

      if (attempt < maxRetries) {
        const delay = appConfig.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('Operation failed after retries and timeouts', lastError);
  throw lastError;
}

/**
 * Monitorer la connectivité réseau
 */
export function monitorConnectivity(onStatusChange) {
  const handleOnline = () => {
    logger.info('Network: Online');
    onStatusChange(true);
  };

  const handleOffline = () => {
    logger.warn('Network: Offline');
    onStatusChange(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Retourner une fonction pour arrêter le monitoring
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export default {
  fetchWithRetry,
  fetchJSON,
  fetchPost,
  isOnline,
  waitForOnline,
  withOfflineFallback,
  withRetryAndFallback,
  withTimeout,
  withRetryAndTimeout,
  monitorConnectivity,
  NetworkError,
  TimeoutError,
  ValidationError
};
