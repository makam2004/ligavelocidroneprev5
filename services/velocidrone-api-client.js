// services/velocidrone-api-client.js
// Cliente para la API oficial de Velocidrone

import fetch from 'node-fetch';
import logger from '../utils/logger.js';

class VelocidroneAPI {
  constructor() {
    this.baseURL = 'https://velocidrone.co.uk/api';
    this.token = process.env.VELOCIDRONE_API_TOKEN;
    this.rateLimit = {
      requests: 0,
      windowStart: Date.now(),
      maxRequests: 6, // 6 requests por minuto según la doc
      windowMs: 60 * 1000 // 1 minuto
    };
    this.cache = new Map();
    this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutos de cache
  }

  // Rate limiting interno
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset window si ha pasado el tiempo
    if (now - this.rateLimit.windowStart >= this.rateLimit.windowMs) {
      this.rateLimit.requests = 0;
      this.rateLimit.windowStart = now;
    }

    // Verificar si podemos hacer la request
    if (this.rateLimit.requests >= this.rateLimit.maxRequests) {
      const waitTime = this.rateLimit.windowMs - (now - this.rateLimit.windowStart);
      logger.warn('🚦 Rate limit alcanzado, esperando', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit(); // Recursivo para verificar de nuevo
    }

    this.rateLimit.requests++;
    return true;
  }

  // Cache helper
  getCacheKey(method, params) {
    return `${method}_${JSON.stringify(params)}`;
  }

  getFromCache(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.CACHE_DURATION) {
      logger.debug('📋 Cache hit', { key });
      return item.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Request base con autenticación y rate limiting
  async makeRequest(endpoint, postData = {}) {
    if (!this.token) {
      throw new Error('VELOCIDRONE_API_TOKEN no configurado');
    }

    await this.checkRateLimit();

    const formData = new URLSearchParams();
    formData.append('post_data', new URLSearchParams(postData).toString());

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`API Response Error: ${data.message || 'Unknown error'}`);
    }

    return data;
  }

  // Obtener leaderboard de un track específico
  async getLeaderboard(trackId, raceMode = 6, simVersion = '1.16', count = 200) {
    const cacheKey = this.getCacheKey('leaderboard', { trackId, raceMode, simVersion });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info('🔍 Obteniendo leaderboard via API', { trackId, raceMode });

      const params = {
        track_id: trackId,
        sim_version: simVersion,
        offset: 0,
        count: count,
        race_mode: raceMode,
        protected_track_value: 1
      };

      const data = await this.makeRequest('/leaderboard', params);
      
      // Procesar y normalizar los datos
      const processed = this.processLeaderboardData(data.tracktimes);
      
      this.setCache(cacheKey, processed);
      logger.info('✅ Leaderboard obtenido via API', { 
        trackId, 
        resultados: processed.length 
      });
      
      return processed;
    } catch (error) {
      logger.error('❌ Error obteniendo leaderboard via API', { 
        trackId, 
        error: error.message 
      });
      throw error;
    }
  }

  // Procesar datos del leaderboard para compatibilidad con el formato actual
  processLeaderboardData(tracktimes) {
    return tracktimes.map(record => ({
      jugador: record.playername,
      tiempo: this.parseTimeToSeconds(record.lap_time),
      modelo: record.model_name,
      pais: record.country,
      version: record.sim_version,
      dispositivo: record.device_type,
      userId: record.user_id,
      fechaCreacion: record.created_at,
      fechaActualizacion: record.updated_at
    }));
  }

  // Convertir formato de tiempo "00:01:23.456" a segundos
  parseTimeToSeconds(timeString) {
    const parts = timeString.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    const totalSeconds = minutes * 60 + seconds;
    return totalSeconds;
  }

  // Obtener todos los modelos disponibles
  async getModels() {
    const cacheKey = this.getCacheKey('models', {});
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info('🔍 Obteniendo modelos via API');
      const data = await this.makeRequest('/get-models');
      
      this.setCache(cacheKey, data.models);
      logger.info('✅ Modelos obtenidos via API', { count: data.models.length });
      
      return data.models;
    } catch (error) {
      logger.error('❌ Error obteniendo modelos via API', { error: error.message });
      throw error;
    }
  }

  // Obtener todos los escenarios disponibles
  async getSceneries() {
    const cacheKey = this.getCacheKey('sceneries', {});
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      logger.info('🔍 Obteniendo escenarios via API');
      const data = await this.makeRequest('/get-sceneries');
      
      this.setCache(cacheKey, data.sceneries);
      logger.info('✅ Escenarios obtenidos via API', { count: data.sceneries.length });
      
      return data.sceneries;
    } catch (error) {
      logger.error('❌ Error obteniendo escenarios via API', { error: error.message });
      throw error;
    }
  }

  // Obtener leaderboard para múltiples tracks (método principal para tu app)
  async getMultipleLeaderboards(trackConfigs, nombresJugadores) {
    const resultados = [];

    for (const config of trackConfigs) {
      try {
        const raceMode = config.pestaña.includes('3 Lap') ? 6 : 3;
        const leaderboard = await this.getLeaderboard(config.track_id, raceMode);
        
        // Filtrar solo los jugadores registrados
        const resultadosFiltrados = leaderboard.filter(record => 
          nombresJugadores.includes(record.jugador)
        );

        resultados.push({
          trackId: config.track_id,
          pista: config.nombre_pista || `Track ${config.track_id}`,
          escenario: config.nombre_escenario || 'Unknown',
          pestaña: config.pestaña,
          resultados: resultadosFiltrados
        });

        // Pequeña pausa entre requests para ser amigable con la API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error('❌ Error obteniendo track via API', { 
          trackId: config.track_id, 
          error: error.message 
        });
        
        // En caso de error, devolver estructura vacía para mantener compatibilidad
        resultados.push({
          trackId: config.track_id,
          pista: 'Error',
          escenario: 'Error',
          pestaña: config.pestaña,
          resultados: []
        });
      }
    }

    return resultados;
  }

  // Método de diagnóstico para verificar el estado de la API
  async healthCheck() {
    try {
      // Intentar obtener modelos como test básico
      await this.getModels();
      return { status: 'healthy', api: 'velocidrone' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        api: 'velocidrone', 
        error: error.message 
      };
    }
  }

  // Limpiar cache manualmente
  clearCache() {
    this.cache.clear();
    logger.info('🧹 Cache de API limpiado');
  }

  // Obtener estadísticas de uso
  getStats() {
    return {
      rateLimit: this.rateLimit,
      cacheSize: this.cache.size,
      hasToken: !!this.token
    };
  }
}

// Instancia singleton
const velocidroneAPI = new VelocidroneAPI();

export default velocidroneAPI;