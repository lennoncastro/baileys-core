import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BaileysService, WhatsAppMessage, InboundMessageData, OutboundMessageData, WhatsAppAuthMethod } from './baileys-service.js';
import { BaileysServiceManager } from './example-multiple-instances.js';
import { appConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Função para encontrar o arquivo HTML
function getHtmlPath(): string {
  // Tentar no diretório atual (dist)
  const distPath = join(__dirname, 'dashboard.html');
  try {
    readFileSync(distPath, 'utf-8');
    return distPath;
  } catch {
    // Tentar no diretório src (desenvolvimento)
    const srcPath = join(__dirname, '..', 'src', 'dashboard.html');
    try {
      readFileSync(srcPath, 'utf-8');
      return srcPath;
    } catch {
      // Fallback para dist
      return distPath;
    }
  }
}

interface ConnectionStatus {
  instanceId: string;
  status: string;
  handlersCount: number;
  qrCode?: string | null;
  pairingCode?: string | null;
  lastMessage?: {
    from?: string;
    to?: string;
    message: string;
    timestamp: Date;
    direction: 'inbound' | 'outbound';
  };
}

class DashboardServer {
  private server: ReturnType<typeof createServer>;
  private manager: BaileysServiceManager;
  private clients: Set<ServerResponse> = new Set();
  private connections: Map<string, ConnectionStatus> = new Map();
  private port: number;
  private host: string;

  constructor(port: number = 3000, host: string = 'localhost') {
    this.port = port;
    this.host = host;
    this.manager = new BaileysServiceManager();
    this.server = createServer(this.handleRequest.bind(this));
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Monitorar mudanças nas instâncias usando intervalo do config
    setInterval(() => {
      this.updateConnectionsStatus();
      this.broadcastUpdate();
    }, appConfig.dashboardUpdateInterval);
  }

  private updateConnectionsStatus() {
    const instances = this.manager.listInstances();
    
    instances.forEach(({ id, status }) => {
      const instance = this.manager.getInstance(id);
      if (!instance) return;

      const connectionStatus: ConnectionStatus = {
        instanceId: id,
        status,
        handlersCount: instance.getMessageHandlerCount(),
        qrCode: instance.getCurrentQrCode(),
        pairingCode: instance.getCurrentPairingCode(),
      };

      // Manter última mensagem se existir
      const existing = this.connections.get(id);
      if (existing?.lastMessage) {
        connectionStatus.lastMessage = existing.lastMessage;
      }

      this.connections.set(id, connectionStatus);
    });
  }

  private broadcastUpdate() {
    const data = JSON.stringify({
      type: 'update',
      connections: Array.from(this.connections.values()),
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((client) => {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (error) {
        this.clients.delete(client);
      }
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // CORS headers
    if (appConfig.enableCors) {
      const origin = req.headers.origin || '';
      if (appConfig.corsOrigins.includes('*') || appConfig.corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Rota para a página HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
      this.serveHTML(res);
      return;
    }

    // Rota para Server-Sent Events (SSE)
    if (url.pathname === '/events') {
      this.handleSSE(req, res);
      return;
    }

    // API: Listar conexões
    if (url.pathname === '/api/connections' && req.method === 'GET') {
      this.handleGetConnections(res);
      return;
    }

    // API: Criar nova instância
    if (url.pathname === '/api/instances' && req.method === 'POST') {
      this.handleCreateInstance(req, res);
      return;
    }

    // API: Conectar instância
    if (url.pathname.startsWith('/api/instances/') && url.pathname.endsWith('/connect') && req.method === 'POST') {
      const instanceId = url.pathname.split('/')[3];
      this.handleConnectInstance(instanceId, req, res);
      return;
    }

    // API: Desconectar instância
    if (url.pathname.startsWith('/api/instances/') && url.pathname.endsWith('/disconnect') && req.method === 'POST') {
      const instanceId = url.pathname.split('/')[3];
      this.handleDisconnectInstance(instanceId, res);
      return;
    }

    // API: Enviar mensagem
    if (url.pathname.startsWith('/api/instances/') && url.pathname.endsWith('/send') && req.method === 'POST') {
      const instanceId = url.pathname.split('/')[3];
      this.handleSendMessage(instanceId, req, res);
      return;
    }

    // API: Obter QR code
    if (url.pathname.startsWith('/api/instances/') && url.pathname.endsWith('/qr') && req.method === 'GET') {
      const instanceId = url.pathname.split('/')[3];
      this.handleGetQrCode(instanceId, res);
      return;
    }

    // API: Obter código de pareamento
    if (url.pathname.startsWith('/api/instances/') && url.pathname.endsWith('/pairing-code') && req.method === 'GET') {
      const instanceId = url.pathname.split('/')[3];
      this.handleGetPairingCode(instanceId, res);
      return;
    }

    // API: Remover instância
    if (url.pathname.startsWith('/api/instances/') && req.method === 'DELETE') {
      const instanceId = url.pathname.split('/')[3];
      this.handleDeleteInstance(instanceId, res);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  private serveHTML(res: ServerResponse) {
    try {
      const htmlPath = getHtmlPath();
      const html = readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Erro ao carregar página HTML: ' + (error as Error).message);
    }
  }

  private handleSSE(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Enviar dados iniciais
    const initialData = JSON.stringify({
      type: 'update',
      connections: Array.from(this.connections.values()),
      timestamp: new Date().toISOString(),
    });
    res.write(`data: ${initialData}\n\n`);

    // Adicionar cliente
    this.clients.add(res);

    // Remover cliente quando desconectar
    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  private handleGetConnections(res: ServerResponse) {
    const connections = Array.from(this.connections.values());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connections }));
  }

  private async handleCreateInstance(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { instanceId } = JSON.parse(body);
        if (!instanceId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'instanceId é obrigatório' }));
          return;
        }

        const instance = this.manager.createInstance(instanceId);
        
        // Configurar callbacks para rastrear mensagens
        instance.onInboundMessage((data) => {
          this.updateLastMessage(instanceId, {
            from: data.from,
            message: data.content,
            timestamp: data.timestamp,
            direction: 'inbound',
          });
          this.broadcastUpdate();
        }, `dashboard-inbound-${instanceId}`);

        instance.onOutboundMessage((data) => {
          this.updateLastMessage(instanceId, {
            to: data.to,
            message: data.content,
            timestamp: data.timestamp,
            direction: 'outbound',
          });
          this.broadcastUpdate();
        }, `dashboard-outbound-${instanceId}`);

        // Configurar callback para QR code
        instance.onQrCode((qr) => {
          this.updateQrCode(instanceId, qr);
          this.broadcastUpdate();
        }, `dashboard-qrcode-${instanceId}`);

        // Configurar callback para código de pareamento
        instance.onPairingCode((pairingCode) => {
          this.updatePairingCode(instanceId, pairingCode);
          this.broadcastUpdate();
        }, `dashboard-pairing-${instanceId}`);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, instanceId }));
      } catch (error: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  private async handleConnectInstance(instanceId: string, req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const authMethod = (url.searchParams.get('authMethod') || 'qr') as WhatsAppAuthMethod;
    const phoneNumber = url.searchParams.get('phoneNumber') || undefined;

    if (authMethod !== 'qr' && authMethod !== 'phone') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'authMethod deve ser "qr" ou "phone"' }));
      return;
    }

    if (authMethod === 'phone' && !phoneNumber) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'phoneNumber é obrigatório quando authMethod="phone"' }));
      return;
    }

    try {
      await this.manager.connectInstance(instanceId, { authMethod, phoneNumber });
      const instance = this.manager.getInstance(instanceId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        authMethod,
        qrCode: instance?.getCurrentQrCode() || null,
        pairingCode: instance?.getCurrentPairingCode() || null,
      }));
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  private async handleDisconnectInstance(instanceId: string, res: ServerResponse) {
    try {
      await this.manager.disconnectInstance(instanceId);
      this.connections.delete(instanceId);
      this.broadcastUpdate();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  private async handleSendMessage(instanceId: string, req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { to, message } = JSON.parse(body);
        if (!to || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'to e message são obrigatórios' }));
          return;
        }

        const instance = this.manager.getInstance(instanceId);
        if (!instance) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Instância não encontrada' }));
          return;
        }

        await instance.sendMessage(to, message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  private updateLastMessage(instanceId: string, message: ConnectionStatus['lastMessage']) {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.lastMessage = message;
      this.connections.set(instanceId, connection);
    }
  }

  private updateQrCode(instanceId: string, qr: string | null) {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.qrCode = qr;
      this.connections.set(instanceId, connection);
    }
  }

  private updatePairingCode(instanceId: string, pairingCode: string | null) {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.pairingCode = pairingCode;
      this.connections.set(instanceId, connection);
    }
  }

  private handleGetQrCode(instanceId: string, res: ServerResponse) {
    const instance = this.manager.getInstance(instanceId);
    if (!instance) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Instância não encontrada' }));
      return;
    }

    const qrCode = instance.getCurrentQrCode();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ qrCode }));
  }


  private handleGetPairingCode(instanceId: string, res: ServerResponse) {
    const instance = this.manager.getInstance(instanceId);
    if (!instance) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Instância não encontrada' }));
      return;
    }

    const pairingCode = instance.getCurrentPairingCode();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pairingCode }));
  }

  private async handleDeleteInstance(instanceId: string, res: ServerResponse) {
    try {
      const instance = this.manager.getInstance(instanceId);
      if (!instance) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Instância não encontrada' }));
        return;
      }

      // Desconectar e remover (disconnectInstance já faz ambos)
      await this.manager.disconnectInstance(instanceId);
      
      // Remover das conexões
      this.connections.delete(instanceId);
      this.broadcastUpdate();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  getManager(): BaileysServiceManager {
    return this.manager;
  }

  start() {
    this.server.listen(this.port, this.host, () => {
      const url = `http://${this.host === '0.0.0.0' ? 'localhost' : this.host}:${this.port}`;
      console.log(`\n🚀 Dashboard disponível em: ${url}\n`);
    });
  }
}

export { DashboardServer };

// Se executado diretamente
if (import.meta.url.endsWith(process.argv[1] || '')) {
  const server = new DashboardServer(3000);
  server.start();
}
