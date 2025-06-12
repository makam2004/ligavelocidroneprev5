// routes/health.js
// Sistema de monitoreo y health checks para Liga Velocidrone

import express from 'express';
import supabase from '../supabaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

class HealthMonitor {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
    this.initializeChecks();
  }

  initializeChecks() {
    // Registro de health checks disponibles
    this.checks.set('database', this.checkDatabase.bind(this));
    this.checks.set('telegram', this.checkTelegram.bind(this));
    this.checks.set('velocidrone', this.checkVelocidrone.bind(this));
    this.checks.set('memory', this.checkMemory.bind(this));
    this.checks.set('disk', this.checkDisk.bind(this));
  }

  async checkDatabase() {
    try {
      const start = Date.now();
      const { data, error } = await supabase
        .from('jugadores')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      const duration = Date.now() - start;
      return {
        status: 'healthy',
        duration,
        details: { connectionTime: `${duration}ms` }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: { service: 'Supabase' }
      };
    }
  }

  async checkTelegram() {
    try {
      const start = Date.now();
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      if (!data.ok) throw new Error(data.description);
      
      const duration = Date.now() - start;
      return {
        status: 'healthy',
        duration,
        details: { 
          botName: data.result.username,
          responseTime: `${duration}ms`
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: { service: 'Telegram Bot API' }
      };
    }
  }

  async checkVelocidrone() {
    try {
      const start = Date.now();
      const response = await fetch('https://www.velocidrone.com/', {
        method: 'HEAD',
        timeout: 10000
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const duration = Date.now() - start;
      return {
        status: 'healthy',
        duration,
        details: { responseTime: `${duration}ms` }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        details: { service: 'Velocidrone.com' }
      };
    }
  }

  checkMemory() {
    try {
      const usage = process.memoryUsage();
      const totalHeap = usage.heapTotal / 1024 / 1024; // MB
      const usedHeap = usage.heapUsed / 1024 / 1024; // MB
      const memoryUsage = (usedHeap / totalHeap) * 100;
      
      const status = memoryUsage > 90 ? 'unhealthy' : 'healthy';
      
      return {
        status,
        details: {
          heapUsed: `${usedHeap.toFixed(2)} MB`,
          heapTotal: `${totalHeap.toFixed(2)} MB`,
          usage: `${memoryUsage.toFixed(2)}%`,
          rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  checkDisk() {
    try {
      // Verificación básica de espacio disponible (mock)
      // En un entorno real, usarías 'fs' para verificar espacio en disco
      return {
        status: 'healthy',
        details: {
          available: 'N/A (Container)',
          note: 'Running in containerized environment'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async runAllChecks() {
    const results = {};
    const promises = [];

    for (const [name, checkFunction] of this.checks) {
      promises.push(
        Promise.resolve(checkFunction())
          .then(result => ({ name, result }))
          .catch(error => ({ 
            name, 
            result: { 
              status: 'error', 
              error: error.message 
            }
          }))
      );
    }

    const checkResults = await Promise.allSettled(promises);
    
    for (const settled of checkResults) {
      if (settled.status === 'fulfilled') {
        const { name, result } = settled.value;
        results[name] = result;
        this.lastResults.set(name, {
          ...result,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  getOverallStatus(results) {
    const statuses = Object.values(results).map(r => r.status);
    
    if (statuses.some(s => s === 'unhealthy' || s === 'error')) {
      return 'unhealthy';
    }
    
    return 'healthy';
  }

  async getDetailedHealth() {
    const checks = await this.runAllChecks();
    const overallStatus = this.getOverallStatus(checks);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks
    };
  }
}

const healthMonitor = new HealthMonitor();

// Health check básico (para load balancers)
router.get('/health', async (req, res) => {
  try {
    const dbCheck = await healthMonitor.checks.get('database')();
    
    if (dbCheck.status === 'healthy') {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'error', error: dbCheck.error });
    }
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

// Health check detallado (para monitoreo)
router.get('/health/detailed', async (req, res) => {
  try {
    const health = await healthMonitor.getDetailedHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
    
    // Log si hay problemas
    if (health.status !== 'healthy') {
      logger.warn('🚨 Health check failed', { health });
    }
  } catch (error) {
    logger.error('❌ Health check error', { error: error.message });
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Métricas específicas de la aplicación
router.get('/metrics', async (req, res) => {
  try {
    // Obtener estadísticas de la aplicación
    const { data: jugadoresCount } = await supabase
      .from('jugadores')
      .select('count');
    
    const { data: resultadosCount } = await supabase
      .from('resultados')
      .select('count');

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      memory_usage: process.memoryUsage(),
      application_metrics: {
        total_players: jugadoresCount?.length || 0,
        total_results: resultadosCount?.length || 0,
        current_week: Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('❌ Metrics error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para forzar health check de un servicio específico
router.get('/health/:service', async (req, res) => {
  const { service } = req.params;
  
  if (!healthMonitor.checks.has(service)) {
    return res.status(404).json({ 
      error: `Service '${service}' not found`,
      available_services: Array.from(healthMonitor.checks.keys())
    });
  }

  try {
    const result = await healthMonitor.checks.get(service)();
    const statusCode = result.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      service,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      service,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware para logging de health checks periódicos
setInterval(async () => {
  try {
    const health = await healthMonitor.getDetailedHealth();
    if (health.status !== 'healthy') {
      logger.warn('🚨 Periodic health check failed', { 
        failedChecks: Object.entries(health.checks)
          .filter(([, result]) => result.status !== 'healthy')
          .map(([name]) => name)
      });
    }
  } catch (error) {
    logger.error('❌ Periodic health check error', { error: error.message });
  }
}, 5 * 60 * 1000); // Cada 5 minutos

export default router;