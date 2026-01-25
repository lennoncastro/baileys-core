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
  
  export class BaileysService {
    private socket: WASocket | null = null;
    private connectionStatus: WhatsAppConnectionStatus = 'disconnected';
    private authDir: string;
    private messageHandlers: Array<(message: WhatsAppMessage) => void> = [];
    public messageRepository?: { 
      save: (message: any) => void;
      findLatestByPhoneNumber: (phoneNumber: string) => any | undefined;
      updateRfqId: (messageId: string, rfqId: string) => boolean;
    };
  
    constructor(authDir?: string) {
      this.authDir = authDir ?? join(__dirname, '../../.whatsapp-auth');
    }
  
    setMessageRepository(repository: { 
      save: (message: any) => void;
      findLatestByPhoneNumber: (phoneNumber: string) => any | undefined;
      updateRfqId: (messageId: string, rfqId: string) => boolean;
    }): void {
      this.messageRepository = repository;
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
  
        this.socket.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect, qr } = update;
  
          if (qr) {
            console.log('\n📱 Escaneie o QR Code abaixo com o WhatsApp:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n💡 No WhatsApp: Menu > Aparelhos conectados > Conectar um aparelho\n');
          }
  
          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
              this.connectionStatus = 'disconnected';
              console.log('🔄 Reconectando ao WhatsApp...');
              this.connect();
            } else {
              this.connectionStatus = 'disconnected';
              console.log('❌ Conexão com WhatsApp encerrada. Faça login novamente.');
            }
          } else if (connection === 'open') {
            this.connectionStatus = 'connected';
            console.log('✅ Conectado ao WhatsApp com sucesso!');
          }
        });
  
        this.socket.ev.on('messages.upsert', ({ messages, type }) => {
          if (type !== 'notify') return;
  
          for (const message of messages) {
            if (!message.key.fromMe && message.message) {
              const messageText = this.extractMessageText(message.message);
              if (messageText) {
                const whatsappMessage: WhatsAppMessage = {
                  from: message.key.remoteJid ?? '',
                  message: messageText,
                  timestamp: new Date(),
                };
  
                // Salvar mensagem recebida
                if (this.messageRepository) {
                  const phoneNumber = whatsappMessage.from.replace('@s.whatsapp.net', '').replace('@c.us', '');
                  const messageId = message.key.id ?? `msg_${Date.now()}_${Math.random()}`;
                  this.messageRepository.save({
                    id: messageId,
                    phoneNumber,
                    direction: 'inbound',
                    content: messageText,
                    timestamp: whatsappMessage.timestamp,
                  });
                  whatsappMessage.messageId = messageId;
                }
  
                this.messageHandlers.forEach((handler) => {
                  try {
                    handler(whatsappMessage);
                  } catch (error) {
                    console.error('Erro ao processar mensagem:', error);
                  }
                });
              }
            }
          }
        });
      } catch (error) {
        this.connectionStatus = 'error';
        console.error('Erro ao conectar ao WhatsApp:', error);
        throw error;
      }
    }
  
    async sendMessage(to: string, message: string, rfqId?: string, quoteId?: string): Promise<void> {
      if (!this.socket || this.connectionStatus !== 'connected') {
        throw new Error('WhatsApp não está conectado');
      }
  
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const phoneNumber = to.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      console.log(`📤 WhatsAppService.sendMessage: Enviando para ${jid} (${to})`);
      console.log(`   Mensagem (primeiros 100 chars): ${message.substring(0, 100)}...`);
      
      try {
        await this.socket.sendMessage(jid, { text: message });
        console.log(`✅ Mensagem enviada com sucesso para ${jid}`);
  
        // Salvar mensagem enviada
        if (this.messageRepository) {
          this.messageRepository.save({
            id: `msg_${Date.now()}_${Math.random()}`,
            phoneNumber,
            direction: 'outbound',
            content: message,
            timestamp: new Date(),
            rfqId,
            quoteId,
          });
        }
      } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${jid}:`, error);
        throw error;
      }
    }
  
    onMessage(handler: (message: WhatsAppMessage) => void): void {
      this.messageHandlers.push(handler);
    }
  
    getConnectionStatus(): WhatsAppConnectionStatus {
      return this.connectionStatus;
    }
  
    async disconnect(): Promise<void> {
      if (this.socket) {
        await this.socket.end(undefined);
        this.socket = null;
        this.connectionStatus = 'disconnected';
      }
    }
  
    private extractMessageText(message: any): string | null {
      if (message.conversation) return message.conversation;
      if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
      if (message.imageMessage?.caption) return message.imageMessage.caption;
      if (message.videoMessage?.caption) return message.videoMessage.caption;
      return null;
    }
  }
  