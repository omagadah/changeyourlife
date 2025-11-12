/**
 * Système de logging centralisé avec support Sentry
 * Gère les logs, erreurs et monitoring
 */

import { appConfig, sentryConfig } from './config.js';

// Initialiser Sentry si disponible
let Sentry = null;
if (sentryConfig.dsn && typeof window !== 'undefined') {
  try {
    // Charger Sentry dynamiquement
    const script = document.createElement('script');
    script.src = 'https://browser.sentry-cdn.com/7.91.0/bundle.min.js';
    script.async = true;
    script.onload = () => {
      if (window.Sentry) {
        window.Sentry.init({
          dsn: sentryConfig.dsn,
          environment: sentryConfig.environment,
          tracesSampleRate: sentryConfig.tracesSampleRate,
          debug: sentryConfig.debug,
          integrations: [
            new window.Sentry.Replay({
              maskAllText: true,
              blockAllMedia: true
            })
          ],
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0
        });
        Sentry = window.Sentry;
      }
    };
    document.head.appendChild(script);
  } catch (e) {
    console.warn('Sentry initialization failed:', e);
  }
}

// Niveaux de log
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Logger centralisé
 */
export class Logger {
  constructor(namespace = 'App') {
    this.namespace = namespace;
    this.isDev = appConfig.isDev;
  }

  /**
   * Formater le message avec namespace
   */
  _format(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.namespace}] [${level.toUpperCase()}]`;
    return { prefix, message, data };
  }

  /**
   * Log de débogage
   */
  debug(message, data = null) {
    if (!this.isDev) return;
    const { prefix, message: msg } = this._format(LogLevel.DEBUG, message, data);
    console.debug(prefix, msg, data || '');
  }

  /**
   * Log d'information
   */
  info(message, data = null) {
    const { prefix, message: msg } = this._format(LogLevel.INFO, message, data);
    console.log(prefix, msg, data || '');
  }

  /**
   * Log d'avertissement
   */
  warn(message, data = null) {
    const { prefix, message: msg } = this._format(LogLevel.WARN, message, data);
    console.warn(prefix, msg, data || '');
    
    if (Sentry) {
      Sentry.captureMessage(message, 'warning');
    }
  }

  /**
   * Log d'erreur
   */
  error(message, error = null, context = null) {
    const { prefix, message: msg } = this._format(LogLevel.ERROR, message, error);
    console.error(prefix, msg, error || '', context || '');
    
    if (Sentry) {
      Sentry.captureException(error || new Error(message), {
        tags: { namespace: this.namespace },
        contexts: { custom: context }
      });
    }
  }

  /**
   * Log critique (erreur grave)
   */
  critical(message, error = null, context = null) {
    const { prefix, message: msg } = this._format(LogLevel.CRITICAL, message, error);
    console.error(prefix, msg, error || '', context || '');
    
    if (Sentry) {
      Sentry.captureException(error || new Error(message), {
        level: 'fatal',
        tags: { namespace: this.namespace },
        contexts: { custom: context }
      });
    }
  }

  /**
   * Mesurer les performances
   */
  time(label) {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        this.debug(`${label} took ${duration.toFixed(2)}ms`);
        return duration;
      }
    };
  }

  /**
   * Capturer une exception
   */
  captureException(error, context = null) {
    this.error('Exception captured', error, context);
  }

  /**
   * Capturer un message
   */
  captureMessage(message, level = 'info') {
    if (Sentry) {
      Sentry.captureMessage(message, level);
    }
    this[level](message);
  }

  /**
   * Ajouter un contexte utilisateur
   */
  setUser(userId, email = null, username = null) {
    if (Sentry) {
      Sentry.setUser({
        id: userId,
        email,
        username
      });
    }
  }

  /**
   * Ajouter des tags
   */
  setTag(key, value) {
    if (Sentry) {
      Sentry.setTag(key, value);
    }
  }

  /**
   * Ajouter un contexte
   */
  setContext(name, context) {
    if (Sentry) {
      Sentry.setContext(name, context);
    }
  }
}

// Créer une instance globale
export const logger = new Logger('CYF');

// Exporter pour utilisation globale
export default logger;
