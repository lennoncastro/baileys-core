// src/whatsapp/whatsapp.service.ts
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
  } from '@whiskeysockets/baileys';
  import type { WASocket } from '@whiskeysockets/baileys';
  import { Boom } from '@hapi/boom';
import pino from 'pino';
import { join, dirname } from 'path';
import qrcode from 'qrcode-terminal';
import { rmSync, existsSync } from 'fs';
  
  const getDirname = (): string => {
    try {
      if (typeof require !== 'undefined' && require.main && require.main.filename) {
        return dirname(require.main.filename);
      }
    } catch {
    }
    return join(process.cwd(), 'src');
  };
  
  const __dirname = getDirname();
  
  export type WhatsAppConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
  
  export interface WhatsAppMessage {
    from: string;
    message: string;
    timestamp: Date;
    messageId?: string;
  }

  export interface InboundMessageData {
    id: string;
    phoneNumber: string;
    direction: 'inbound';
    content: string;
    timestamp: Date;
    from: string;
    messageId?: string;
  }

  export interface OutboundMessageData {
    id: string;
    phoneNumber: string;
    direction: 'outbound';
    content: string;
    timestamp: Date;
    to: string;
  }
  
  export class BaileysService {
    private socket: WASocket | null = null;
    private connectionStatus: WhatsAppConnectionStatus = 'disconnected';
    private authDir: string;
    private instanceId?: string;
    private messageHandlers: Map<string, (message: WhatsAppMessage) => void> = new Map();
    private onInboundMessageCallbacks: Map<string, (data: InboundMessageData) => void> = new Map();
    private onOutboundMessageCallbacks: Map<string, (data: OutboundMessageData) => void> = new Map();
    private onQrCodeCallbacks: Map<string, (qr: string) => void> = new Map();
    private onDisconnectCallbacks: Map<string, (reason?: string) => void> = new Map();
    private onConnectCallbacks: Map<string, () => void> = new Map();
    private currentQrCode: string | null = null;
  
    constructor(authDir?: string, instanceId?: string) {
      this.authDir = authDir ?? join(__dirname, '../../.whatsapp-auth');
      this.instanceId = instanceId;
    }
    
    /**
     * Obter o ID da instância
     */
    getInstanceId(): string | undefined {
      return this.instanceId;
    }
    
    /**
     * Definir o ID da instância
     */
    setInstanceId(instanceId: string): void {
      this.instanceId = instanceId;
    }
  
    async connect(): Promise<void> {
      if (this.socket && this.connectionStatus === 'connected') {
        return;
      }
  
      this.connectionStatus = 'connecting';
  
      try {
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
        const { version } = await fetchLatestBaileysVersion();
  
        this.socket = makeWASocket({
          version,
          logger: pino({ level: 'silent' }),
          printQRInTerminal: false, 
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
          },
        });
  
        this.socket.ev.on('creds.update', saveCreds);
  
        this.socket.ev.on('connection.update', (update: any) => {
          const { connection, lastDisconnect, qr } = update;
  
          if (qr) {
            this.currentQrCode = qr;
            const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
            console.log(`\n${instanceLabel}📱 Escaneie o QR Code abaixo com o WhatsApp:\n`);
            qrcode.generate(qr, { small: true });
            console.log(`\n${instanceLabel}💡 No WhatsApp: Menu > Aparelhos conectados > Conectar um aparelho\n`);
            
            // Executar callbacks de QR code
            this.onQrCodeCallbacks.forEach((callback) => {
              try {
                callback(qr);
              } catch (error) {
                const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
                console.error(`${instanceLabel}Erro ao executar callback de QR code:`, error);
              }
            });
          } else {
            this.currentQrCode = null;
          }
  
          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            const disconnectReason = (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut 
              ? 'loggedOut' 
              : (lastDisconnect?.error as Boom)?.output?.statusCode 
                ? `error_${(lastDisconnect?.error as Boom)?.output?.statusCode}` 
                : 'unknown';
            
            this.connectionStatus = 'disconnected';
            
            // Executar callbacks de desconexão
            this.onDisconnectCallbacks.forEach((callback, callbackId) => {
              try {
                callback(disconnectReason);
              } catch (error) {
                const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
                console.error(`${instanceLabel}Erro ao executar callback de desconexão "${callbackId}":`, error);
              }
            });
            
            if (shouldReconnect) {
              const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
              console.log(`${instanceLabel}🔄 Reconectando ao WhatsApp...`);
              this.connect();
            } else {
              const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
              console.log(`${instanceLabel}❌ Conexão com WhatsApp encerrada.`);
              console.log(`${instanceLabel}💡 Para gerar um novo QR code, chame: whatsapp.generateNewQrCode()`);
            }
          } else if (connection === 'open') {
            this.connectionStatus = 'connected';
            const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
            console.log(`${instanceLabel}✅ Conectado ao WhatsApp com sucesso!`);
            
            // Executar callbacks de conexão
            this.onConnectCallbacks.forEach((callback, callbackId) => {
              try {
                callback();
              } catch (error) {
                const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
                console.error(`${instanceLabel}Erro ao executar callback de conexão "${callbackId}":`, error);
              }
            });
          }
        });
  
        this.socket.ev.on('messages.upsert', ({ messages, type }: { messages: any[], type: string }) => {
          if (type !== 'notify') return;
  
          for (const message of messages) {
            if (!message.key.fromMe && message.message) {
              const messageText = this.extractMessageText(message.message);
              if (messageText) {
                const whatsappMessage: WhatsAppMessage = {
                  from: message.key.remoteJid ?? '',
                  message: messageText,
                  timestamp: new Date(),
                  messageId: message.key.id || undefined,
                };

                // Executar callbacks de mensagem recebida (inbound)
                const phoneNumber = whatsappMessage.from.replace('@s.whatsapp.net', '').replace('@c.us', '');
                const messageId = message.key.id || `msg_${Date.now()}_${Math.random()}`;
                const inboundData: InboundMessageData = {
                  id: messageId,
                  phoneNumber,
                  direction: 'inbound',
                  content: messageText,
                  timestamp: whatsappMessage.timestamp,
                  from: whatsappMessage.from,
                  messageId: whatsappMessage.messageId,
                };

                this.onInboundMessageCallbacks.forEach((callback, callbackId) => {
                  try {
                    callback(inboundData);
                  } catch (error) {
                    const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
                    console.error(`${instanceLabel}Erro ao executar callback de mensagem recebida "${callbackId}":`, error);
                  }
                });
  
                // Executar todos os handlers desta instância
                this.messageHandlers.forEach((handler, handlerId) => {
                  try {
                    handler(whatsappMessage);
                  } catch (error) {
                    const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
                    console.error(`${instanceLabel}Erro ao processar mensagem no handler "${handlerId}":`, error);
                  }
                });
              }
            }
          }
        });
      } catch (error) {
        this.connectionStatus = 'error';
        const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
        console.error(`${instanceLabel}Erro ao conectar ao WhatsApp:`, error);
        throw error;
      }
    }
  
    async sendMessage(to: string, message: string): Promise<void> {
      if (!this.socket || this.connectionStatus !== 'connected') {
        throw new Error('WhatsApp não está conectado');
      }
  
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
      
      console.log(`${instanceLabel}📤 WhatsAppService.sendMessage: Enviando para ${jid} (${to})`);
      console.log(`${instanceLabel}   Mensagem (primeiros 100 chars): ${message.substring(0, 100)}...`);
      
      try {
        const result = await this.socket.sendMessage(jid, { text: message });
        const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
        console.log(`${instanceLabel}✅ Mensagem enviada com sucesso para ${jid}`);

        // Executar callbacks de mensagem enviada (outbound)
        const phoneNumber = to.replace('@s.whatsapp.net', '').replace('@c.us', '');
        const outboundData: OutboundMessageData = {
          id: result?.key?.id || `msg_${Date.now()}_${Math.random()}`,
          phoneNumber,
          direction: 'outbound',
          content: message,
          timestamp: new Date(),
          to: jid,
        };

        this.onOutboundMessageCallbacks.forEach((callback, callbackId) => {
          try {
            callback(outboundData);
          } catch (error) {
            const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
            console.error(`${instanceLabel}Erro ao executar callback de mensagem enviada "${callbackId}":`, error);
          }
        });
      } catch (error) {
        const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
        console.error(`${instanceLabel}❌ Erro ao enviar mensagem para ${jid}:`, error);
        throw error;
      }
    }
  
    /**
     * Registrar um handler de mensagem para esta instância
     * @param handler Função callback que será chamada quando uma mensagem for recebida
     * @param handlerId ID opcional para identificar o handler (útil para remover depois)
     * @returns O ID do handler (gerado automaticamente se não fornecido)
     */
    onMessage(handler: (message: WhatsAppMessage) => void, handlerId?: string): string {
      const id = handlerId ?? `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.messageHandlers.set(id, handler);
      return id;
    }
    
    /**
     * Remover um handler de mensagem específico desta instância
     * @param handlerId ID do handler a ser removido
     * @returns true se o handler foi removido, false se não foi encontrado
     */
    offMessage(handlerId: string): boolean {
      return this.messageHandlers.delete(handlerId);
    }
    
    /**
     * Remover todos os handlers de mensagem desta instância
     */
    clearMessageHandlers(): void {
      this.messageHandlers.clear();
    }
    
    /**
     * Obter o número de handlers registrados nesta instância
     */
    getMessageHandlerCount(): number {
      return this.messageHandlers.size;
    }
    
    /**
     * Listar todos os IDs dos handlers registrados nesta instância
     */
    getMessageHandlerIds(): string[] {
      return Array.from(this.messageHandlers.keys());
    }

    /**
     * Registrar callback para quando uma mensagem é recebida (inbound)
     * @param callback Função callback que será chamada quando uma mensagem for recebida
     * @param callbackId ID opcional para identificar o callback (útil para remover depois)
     * @returns O ID do callback (gerado automaticamente se não fornecido)
     */
    onInboundMessage(callback: (data: InboundMessageData) => void, callbackId?: string): string {
      const id = callbackId ?? `inbound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.onInboundMessageCallbacks.set(id, callback);
      return id;
    }

    /**
     * Remover callback de mensagem recebida específico desta instância
     * @param callbackId ID do callback a ser removido
     * @returns true se o callback foi removido, false se não foi encontrado
     */
    offInboundMessage(callbackId: string): boolean {
      return this.onInboundMessageCallbacks.delete(callbackId);
    }

    /**
     * Registrar callback para quando uma mensagem é enviada (outbound)
     * @param callback Função callback que será chamada quando uma mensagem for enviada
     * @param callbackId ID opcional para identificar o callback (útil para remover depois)
     * @returns O ID do callback (gerado automaticamente se não fornecido)
     */
    onOutboundMessage(callback: (data: OutboundMessageData) => void, callbackId?: string): string {
      const id = callbackId ?? `outbound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.onOutboundMessageCallbacks.set(id, callback);
      return id;
    }

    /**
     * Remover callback de mensagem enviada específico desta instância
     * @param callbackId ID do callback a ser removido
     * @returns true se o callback foi removido, false se não foi encontrado
     */
    offOutboundMessage(callbackId: string): boolean {
      return this.onOutboundMessageCallbacks.delete(callbackId);
    }

    /**
     * Limpar todos os callbacks de mensagem recebida desta instância
     */
    clearInboundMessageCallbacks(): void {
      this.onInboundMessageCallbacks.clear();
    }

    /**
     * Limpar todos os callbacks de mensagem enviada desta instância
     */
    clearOutboundMessageCallbacks(): void {
      this.onOutboundMessageCallbacks.clear();
    }

    /**
     * Limpar todos os callbacks (inbound e outbound) desta instância
     */
    clearAllCallbacks(): void {
      this.onInboundMessageCallbacks.clear();
      this.onOutboundMessageCallbacks.clear();
      this.onQrCodeCallbacks.clear();
      this.onDisconnectCallbacks.clear();
      this.onConnectCallbacks.clear();
    }

    /**
     * Registrar callback para quando a conexão é desconectada
     * @param callback Função callback que será chamada quando a conexão for desconectada
     * @param callbackId ID opcional para identificar o callback
     * @returns O ID do callback (gerado automaticamente se não fornecido)
     */
    onDisconnect(callback: (reason?: string) => void, callbackId?: string): string {
      const id = callbackId ?? `disconnect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.onDisconnectCallbacks.set(id, callback);
      return id;
    }

    /**
     * Remover callback de desconexão específico desta instância
     * @param callbackId ID do callback a ser removido
     * @returns true se o callback foi removido, false se não foi encontrado
     */
    offDisconnect(callbackId: string): boolean {
      return this.onDisconnectCallbacks.delete(callbackId);
    }

    /**
     * Registrar callback para quando a conexão é estabelecida
     * @param callback Função callback que será chamada quando a conexão for estabelecida
     * @param callbackId ID opcional para identificar o callback
     * @returns O ID do callback (gerado automaticamente se não fornecido)
     */
    onConnect(callback: () => void, callbackId?: string): string {
      const id = callbackId ?? `connect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.onConnectCallbacks.set(id, callback);
      return id;
    }

    /**
     * Remover callback de conexão específico desta instância
     * @param callbackId ID do callback a ser removido
     * @returns true se o callback foi removido, false se não foi encontrado
     */
    offConnect(callbackId: string): boolean {
      return this.onConnectCallbacks.delete(callbackId);
    }

    /**
     * Limpar todos os callbacks de desconexão desta instância
     */
    clearDisconnectCallbacks(): void {
      this.onDisconnectCallbacks.clear();
    }

    /**
     * Limpar todos os callbacks de conexão desta instância
     */
    clearConnectCallbacks(): void {
      this.onConnectCallbacks.clear();
    }

    /**
     * Registrar callback para quando um QR code for gerado
     * @param callback Função callback que será chamada quando um QR code for gerado
     * @param callbackId ID opcional para identificar o callback
     * @returns O ID do callback (gerado automaticamente se não fornecido)
     */
    onQrCode(callback: (qr: string) => void, callbackId?: string): string {
      const id = callbackId ?? `qrcode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.onQrCodeCallbacks.set(id, callback);
      
      // Se já existe um QR code, chamar o callback imediatamente
      if (this.currentQrCode) {
        try {
          callback(this.currentQrCode);
        } catch (error) {
          const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
          console.error(`${instanceLabel}Erro ao executar callback de QR code:`, error);
        }
      }
      
      return id;
    }

    /**
     * Remover callback de QR code específico desta instância
     * @param callbackId ID do callback a ser removido
     * @returns true se o callback foi removido, false se não foi encontrado
     */
    offQrCode(callbackId: string): boolean {
      return this.onQrCodeCallbacks.delete(callbackId);
    }

    /**
     * Obter QR code atual (se disponível)
     * @returns QR code atual ou null se não houver
     */
    getCurrentQrCode(): string | null {
      return this.currentQrCode;
    }
  
    getConnectionStatus(): WhatsAppConnectionStatus {
      return this.connectionStatus;
    }
  
    async disconnect(): Promise<void> {
      if (this.socket) {
        await this.socket.end(undefined);
        this.socket = null;
        this.connectionStatus = 'disconnected';
        
        // Executar callbacks de desconexão manual
        this.onDisconnectCallbacks.forEach((callback, callbackId) => {
          try {
            callback('manual');
          } catch (error) {
            const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
            console.error(`${instanceLabel}Erro ao executar callback de desconexão "${callbackId}":`, error);
          }
        });
      }
    }

    /**
     * Gera um novo QR code manualmente, limpando as credenciais existentes
     * Útil quando o usuário foi deslogado e precisa fazer login novamente
     */
    async generateNewQrCode(): Promise<void> {
      const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
      
      // Desconectar se estiver conectado
      if (this.socket) {
        await this.disconnect();
      }
      
      // Limpar credenciais para forçar geração de novo QR code
      if (existsSync(this.authDir)) {
        try {
          rmSync(this.authDir, { recursive: true, force: true });
          console.log(`${instanceLabel}🗑️ Credenciais antigas removidas.`);
        } catch (error) {
          const instanceLabel = this.instanceId ? `[${this.instanceId}] ` : '';
          console.error(`${instanceLabel}Erro ao limpar credenciais:`, error);
        }
      }
      
      // Limpar QR code atual
      this.currentQrCode = null;
      
      // Reconectar para gerar novo QR code
      console.log(`${instanceLabel}🔄 Gerando novo QR code...`);
      await this.connect();
    }
  
    private extractMessageText(message: any): string | null {
      if (message.conversation) return message.conversation;
      if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
      if (message.imageMessage?.caption) return message.imageMessage.caption;
      if (message.videoMessage?.caption) return message.videoMessage.caption;
      return null;
    }
  }
  