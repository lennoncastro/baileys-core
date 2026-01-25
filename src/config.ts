import { config } from 'dotenv';
import { join } from 'path';

// Carregar variáveis de ambiente
config();

export interface AppConfig {
  port: number;
  authBaseDir: string;
  dashboardHost: string;
  logLevel: string;
  reconnectTimeout: number;
  dashboardUpdateInterval: number;
  enableCors: boolean;
  corsOrigins: string[];
  instancePrefix: string;
  maxInstances: number;
}

function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  if (value === '*') return ['*'];
  return value.split(',').map((item: string) => item.trim()).filter(Boolean);
}

export const appConfig: AppConfig = {
  port: getEnvNumber('PORT', 3000),
  authBaseDir: getEnv('AUTH_BASE_DIR', '.whatsapp-auth'),
  dashboardHost: getEnv('DASHBOARD_HOST', 'localhost'),
  logLevel: getEnv('LOG_LEVEL', 'silent'),
  reconnectTimeout: getEnvNumber('RECONNECT_TIMEOUT', 5000),
  dashboardUpdateInterval: getEnvNumber('DASHBOARD_UPDATE_INTERVAL', 1000),
  enableCors: getEnvBoolean('ENABLE_CORS', true),
  corsOrigins: getEnvArray('CORS_ORIGINS', ['*']),
  instancePrefix: getEnv('INSTANCE_PREFIX', ''),
  maxInstances: getEnvNumber('MAX_INSTANCES', 0),
};

// Função auxiliar para obter caminho completo de autenticação
export function getAuthDir(instanceId?: string): string {
  const baseDir = appConfig.authBaseDir;
  if (instanceId) {
    return join(process.cwd(), `${baseDir}-${instanceId}`);
  }
  return join(process.cwd(), baseDir);
}

// Validar configuração
export function validateConfig(): void {
  if (appConfig.port < 1 || appConfig.port > 65535) {
    throw new Error(`PORT deve estar entre 1 e 65535. Valor atual: ${appConfig.port}`);
  }

  if (appConfig.maxInstances < 0) {
    throw new Error(`MAX_INSTANCES deve ser >= 0. Valor atual: ${appConfig.maxInstances}`);
  }

  if (!['silent', 'error', 'warn', 'info', 'debug'].includes(appConfig.logLevel)) {
    console.warn(`LOG_LEVEL inválido: ${appConfig.logLevel}. Usando 'silent' como padrão.`);
    appConfig.logLevel = 'silent';
  }
}

// Executar validação ao importar
validateConfig();
