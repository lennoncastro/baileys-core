import { BaileysService, WhatsAppMessage, ConnectOptions } from './baileys-service.js';
import { join } from 'path';
import { getAuthDir, appConfig } from './config.js';

/**
 * Exemplo de como usar múltiplas instâncias do BaileysService
 * para ter N conexões WhatsApp simultâneas
 */
export async function exemploMultiplasInstancias() {
  // Criar múltiplas instâncias, cada uma com seu próprio diretório de autenticação
  const instancias: BaileysService[] = [];
  
  // Instância 1 - WhatsApp número 1 (com ID para identificação)
  const whatsapp1 = new BaileysService(
    join(process.cwd(), '.whatsapp-auth-instance-1'),
    'instancia-1'
  );
  instancias.push(whatsapp1);
  
  // Instância 2 - WhatsApp número 2 (com ID para identificação)
  const whatsapp2 = new BaileysService(
    join(process.cwd(), '.whatsapp-auth-instance-2'),
    'instancia-2'
  );
  instancias.push(whatsapp2);
  
  // Instância 3 - WhatsApp número 3 (com ID para identificação)
  const whatsapp3 = new BaileysService(
    join(process.cwd(), '.whatsapp-auth-instance-3'),
    'instancia-3'
  );
  instancias.push(whatsapp3);
  
  // Conectar todas as instâncias simultaneamente
  console.log('🔌 Conectando todas as instâncias...');
  await Promise.all(instancias.map((instance, index) => {
    console.log(`Conectando instância ${index + 1}...`);
    return instance.connect();
  }));
  
  // Aguardar todas ficarem conectadas
  console.log('⏳ Aguardando conexões...');
  while (instancias.some(instance => instance.getConnectionStatus() !== 'connected')) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mostrar status de cada instância
    instancias.forEach((instance, index) => {
      const status = instance.getConnectionStatus();
      console.log(`Instância ${index + 1}: ${status}`);
    });
  }
  
  console.log('✅ Todas as instâncias conectadas!');
  
  // Configurar handlers de mensagem para cada instância (cada instância tem seus próprios handlers)
  whatsapp1.onMessage((message: WhatsAppMessage) => {
    console.log(`[Instância 1] Mensagem de ${message.from}: ${message.message}`);
  }, 'handler-1-main');
  
  // Adicionar handler adicional na instância 1
  whatsapp1.onMessage((message) => {
    if (message.message.includes('urgente')) {
      console.log('[Instância 1] ⚠️ Mensagem urgente!');
    }
  }, 'handler-1-urgente');
  
  whatsapp2.onMessage((message: WhatsAppMessage) => {
    console.log(`[Instância 2] Mensagem de ${message.from}: ${message.message}`);
  }, 'handler-2-main');
  
  whatsapp3.onMessage((message: WhatsAppMessage) => {
    console.log(`[Instância 3] Mensagem de ${message.from}: ${message.message}`);
  }, 'handler-3-main');
  
  // Verificar handlers de cada instância
  console.log(`\n📊 Handlers registrados:`);
  console.log(`Instância 1: ${whatsapp1.getMessageHandlerCount()} handlers - IDs: ${whatsapp1.getMessageHandlerIds().join(', ')}`);
  console.log(`Instância 2: ${whatsapp2.getMessageHandlerCount()} handlers - IDs: ${whatsapp2.getMessageHandlerIds().join(', ')}`);
  console.log(`Instância 3: ${whatsapp3.getMessageHandlerCount()} handlers - IDs: ${whatsapp3.getMessageHandlerIds().join(', ')}`);
  
  // Exemplo: remover um handler específico
  // whatsapp1.offMessage('handler-1-urgente');
  
  // Exemplo: limpar todos os handlers de uma instância
  // whatsapp1.clearMessageHandlers();
  
  // Exemplo: enviar mensagem usando instância específica
  // await whatsapp1.sendMessage('5511999999999', 'Mensagem da instância 1');
  // await whatsapp2.sendMessage('5511888888888', 'Mensagem da instância 2');
  
  return instancias;
}

/**
 * Exemplo de gerenciamento dinâmico de múltiplas instâncias
 */
export class BaileysServiceManager {
  private instances: Map<string, BaileysService> = new Map();
  
  /**
   * Criar uma nova instância com um ID único
   */
  createInstance(instanceId: string, authDir?: string): BaileysService {
    if (this.instances.has(instanceId)) {
      throw new Error(`Instância com ID "${instanceId}" já existe`);
    }
    
    // Validar limite de instâncias
    if (appConfig.maxInstances > 0 && this.instances.size >= appConfig.maxInstances) {
      throw new Error(`Limite máximo de ${appConfig.maxInstances} instâncias atingido`);
    }
    
    // Usar prefixo no authDir se configurado, mas manter instanceId original no Map
    const authInstanceId = appConfig.instancePrefix 
      ? `${appConfig.instancePrefix}-${instanceId}` 
      : instanceId;
    
    const authPath = authDir ?? getAuthDir(authInstanceId);
    const instance = new BaileysService(authPath, instanceId);
    this.instances.set(instanceId, instance);
    
    console.log(`✅ Instância "${instanceId}" criada`);
    return instance;
  }
  
  /**
   * Obter uma instância pelo ID
   */
  getInstance(instanceId: string): BaileysService | undefined {
    return this.instances.get(instanceId);
  }
  
  /**
   * Conectar uma instância específica
   */
  async connectInstance(instanceId: string, options?: ConnectOptions): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instância "${instanceId}" não encontrada`);
    }
    
    await instance.connect(options);
  }
  
  /**
   * Conectar todas as instâncias
   */
  async connectAll(): Promise<void> {
    console.log(`🔌 Conectando ${this.instances.size} instâncias...`);
    await Promise.all(
      Array.from(this.instances.entries()).map(async ([id, instance]) => {
        console.log(`Conectando instância "${id}"...`);
        await instance.connect();
      })
    );
  }
  
  /**
   * Desconectar uma instância específica
   */
  async disconnectInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instância "${instanceId}" não encontrada`);
    }
    
    await instance.disconnect();
    this.instances.delete(instanceId);
    console.log(`❌ Instância "${instanceId}" desconectada e removida`);
  }
  
  /**
   * Desconectar todas as instâncias
   */
  async disconnectAll(): Promise<void> {
    console.log(`🔌 Desconectando ${this.instances.size} instâncias...`);
    await Promise.all(
      Array.from(this.instances.values()).map(instance => instance.disconnect())
    );
    this.instances.clear();
  }
  
  /**
   * Listar todas as instâncias e seus status
   */
  listInstances(): Array<{ id: string; status: string }> {
    return Array.from(this.instances.entries()).map(([id, instance]) => ({
      id,
      status: instance.getConnectionStatus()
    }));
  }
  
  /**
   * Obter número de instâncias ativas
   */
  getInstanceCount(): number {
    return this.instances.size;
  }
}

/**
 * Exemplo de uso do gerenciador
 */
export async function exemploComGerenciador() {
  const manager = new BaileysServiceManager();
  
  // Criar múltiplas instâncias
  const instance1 = manager.createInstance('cliente-1');
  const instance2 = manager.createInstance('cliente-2');
  const instance3 = manager.createInstance('cliente-3');
  
  // Configurar handlers antes de conectar (cada instância tem seus próprios handlers)
  instance1.onMessage((message) => {
    console.log(`[Cliente 1] ${message.from}: ${message.message}`);
  }, 'cliente-1-main-handler');
  
  // Adicionar handler adicional para cliente 1
  instance1.onMessage((message) => {
    if (message.message.toLowerCase().includes('help')) {
      console.log('[Cliente 1] 🆘 Solicitação de ajuda detectada!');
    }
  }, 'cliente-1-help-handler');
  
  instance2.onMessage((message) => {
    console.log(`[Cliente 2] ${message.from}: ${message.message}`);
  }, 'cliente-2-main-handler');
  
  instance3.onMessage((message) => {
    console.log(`[Cliente 3] ${message.from}: ${message.message}`);
  }, 'cliente-3-main-handler');
  
  // Verificar handlers de cada instância
  console.log(`\n📊 Handlers por instância:`);
  console.log(`Cliente 1: ${instance1.getMessageHandlerCount()} handlers`);
  console.log(`Cliente 2: ${instance2.getMessageHandlerCount()} handlers`);
  console.log(`Cliente 3: ${instance3.getMessageHandlerCount()} handlers`);
  
  // Conectar todas
  await manager.connectAll();
  
  // Aguardar conexões
  while (manager.listInstances().some(i => i.status !== 'connected')) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Status:', manager.listInstances());
  }
  
  // Enviar mensagem usando instância específica
  const cliente1 = manager.getInstance('cliente-1');
  if (cliente1) {
    await cliente1.sendMessage('5511999999999', 'Olá da instância cliente-1!');
  }
  
  // Listar todas as instâncias
  console.log('Instâncias ativas:', manager.listInstances());
  
  // Desconectar uma instância específica
  // await manager.disconnectInstance('cliente-2');
  
  // Desconectar todas ao finalizar
  // await manager.disconnectAll();
  
  return manager;
}
