// utils/logger.js
// Sistema de logging mejorado para tu aplicación

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(context).length > 0 
      ? ` | Context: ${JSON.stringify(context)}` 
      : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  log(level, message, context = {}) {
    const formattedMessage = this.formatMessage(level, message, context);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }

    // En producción, podrías enviar logs críticos a un servicio externo
    if (!this.isDevelopment && (level === 'error' || level === 'warn')) {
      this.sendToExternalService(level, message, context);
    }
  }

  info(message, context = {}) {
    this.log('info', message, context);
  }

  error(message, context = {}) {
    this.log('error', message, context);
  }

  warn(message, context = {}) {
    this.log('warn', message, context);
  }

  debug(message, context = {}) {
    this.log('debug', message, context);
  }

  // Logs específicos para tu aplicación
  scrapingStart(url, piloto = null) {
    this.info('🔍 Inicio de scraping', { url, piloto, action: 'scraping_start' });
  }

  scrapingSuccess(url, resultados) {
    this.info('✅ Scraping exitoso', { 
      url, 
      resultadosCount: resultados.length, 
      action: 'scraping_success' 
    });
  }

  scrapingError(url, error) {
    this.error('❌ Error en scraping', { 
      url, 
      error: error.message, 
      stack: error.stack,
      action: 'scraping_error' 
    });
  }

  telegramSent(tipo, destinatario, thread = null) {
    this.info('📤 Mensaje enviado a Telegram', { 
      tipo, 
      destinatario, 
      thread,
      action: 'telegram_sent' 
    });
  }

  telegramError(error, destinatario) {
    this.error('❌ Error enviando a Telegram', { 
      error: error.message, 
      destinatario,
      action: 'telegram_error' 
    });
  }

  playerRegistered(nombre, ip = null) {
    this.info('👤 Nuevo piloto registrado', { 
      nombre, 
      ip: ip?.substring(0, 8) + '***', // Ofuscar IP por privacidad
      action: 'player_registered' 
    });
  }

  rankingCommit(semana) {
    this.info('🏆 Commit de ranking realizado', { 
      semana, 
      timestamp: new Date().toISOString(),
      action: 'ranking_commit' 
    });
  }

  configUpdate(tracks) {
    this.info('⚙️ Configuración de tracks actualizada', { 
      tracks,
      action: 'config_update' 
    });
  }

  mejoraTiempo(piloto, track, tiempoAnterior, tiempoNuevo) {
    const mejora = (tiempoAnterior - tiempoNuevo).toFixed(2);
    this.info('⏱️ Nueva mejora de tiempo detectada', { 
      piloto, 
      track, 
      tiempoAnterior, 
      tiempoNuevo, 
      mejora: `${mejora}s`,
      action: 'tiempo_mejorado' 
    });
  }

  performanceMetric(operation, duration, details = {}) {
    const message = `⚡ Performance: ${operation} completada en ${duration}ms`;
    if (duration > 5000) {
      this.warn(message, { ...details, duration, slow: true });
    } else {
      this.debug(message, { ...details, duration });
    }
  }

  // Método para enviar logs críticos a servicio externo (opcional)
  async sendToExternalService(level, message, context) {
    // Implementar según tus necesidades:
    // - Webhook a Discord/Slack
    // - Servicio de logging como LogRocket, Sentry
    // - Base de datos de logs
    
    if (process.env.WEBHOOK_LOGS_URL) {
      try {
        await fetch(process.env.WEBHOOK_LOGS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            message,
            context,
            timestamp: new Date().toISOString(),
            app: 'liga-velocidrone'
          })
        });
      } catch (err) {
        console.error('Failed to send log to external service:', err.message);
      }
    }
  }

  // Middleware para Express
  expressMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        
        this.log(level, `${req.method} ${req.path}`, {
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent')?.substring(0, 100)
        });
      });
      
      next();
    };
  }
}

// Instancia singleton
const logger = new Logger();

// Decorador para medir performance de funciones
export function measurePerformance(operation) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        logger.performanceMetric(operation, duration, { 
          method: propertyKey,
          args: args.length 
        });
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.performanceMetric(operation, duration, { 
          method: propertyKey,
          error: error.message,
          failed: true 
        });
        throw error;
      }
    };
    
    return descriptor;
  };
}

export default logger;