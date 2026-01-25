import { BaileysService, WhatsAppMessage } from './baileys-service.js';

// Exemplo básico de uso
export async function exemploBasico() {
  // 1. Criar instância do serviço
  const whatsapp = new BaileysService();
  
  // 2. Conectar ao WhatsApp
  console.log('Conectando ao WhatsApp...');
  await whatsapp.connect();
  // Aguarde o QR Code aparecer e escaneie com o WhatsApp
  
  // 3. Aguardar conexão
  while (whatsapp.getConnectionStatus() !== 'connected') {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 4. Enviar uma mensagem
  const numero = '5511999999999'; // Número com código do país (sem +)
  await whatsapp.sendMessage(numero, 'Olá! Esta é uma mensagem de teste.');
  
  // 5. Escutar mensagens recebidas (cada instância tem seus próprios handlers)
  const handlerId = whatsapp.onMessage((message: WhatsAppMessage) => {
    console.log(`Mensagem recebida de ${message.from}:`);
    console.log(`  Texto: ${message.message}`);
    console.log(`  Timestamp: ${message.timestamp}`);
    
    // Exemplo: responder automaticamente
    if (message.message.toLowerCase().includes('oi')) {
      whatsapp.sendMessage(message.from, 'Olá! Como posso ajudar?');
    }
  }, 'main-handler'); // ID opcional para identificar o handler
  
  console.log(`Handler registrado com ID: ${handlerId}`);
  
  // Exemplo: adicionar múltiplos handlers na mesma instância
  whatsapp.onMessage((message) => {
    console.log(`[Log Handler] Nova mensagem recebida`);
  }, 'log-handler');
  
  // Exemplo: remover um handler específico
  // whatsapp.offMessage('log-handler');
  
  // Exemplo: ver quantos handlers estão registrados
  console.log(`Handlers ativos: ${whatsapp.getMessageHandlerCount()}`);
  
  // 6. Desconectar (quando necessário)
  // await whatsapp.disconnect();
}

// Exemplo com tratamento de erros
export async function exemploComTratamentoErros() {
  const whatsapp = new BaileysService();
  
  try {
    await whatsapp.connect();
    
    // Verificar status da conexão
    const status = whatsapp.getConnectionStatus();
    console.log('Status da conexão:', status);
    
    if (status === 'connected') {
      await whatsapp.sendMessage('5511999999999', 'Teste');
    } else {
      console.log('Aguardando conexão...');
    }
    
  } catch (error) {
    console.error('Erro ao usar WhatsApp:', error);
  } finally {
    // Sempre desconectar ao finalizar
    await whatsapp.disconnect();
  }
}

// Exemplo com múltiplas instâncias e handlers por instância
export async function exemploMultiplasInstanciasComHandlers() {
  // Criar instâncias com IDs únicos
  const whatsapp1 = new BaileysService('.whatsapp-auth-1', 'instancia-1');
  const whatsapp2 = new BaileysService('.whatsapp-auth-2', 'instancia-2');
  
  // Cada instância tem seus próprios handlers
  whatsapp1.onMessage((message) => {
    console.log(`[Instância 1] Mensagem de ${message.from}: ${message.message}`);
    // Lógica específica para instância 1
  }, 'handler-instancia-1');
  
  whatsapp2.onMessage((message) => {
    console.log(`[Instância 2] Mensagem de ${message.from}: ${message.message}`);
    // Lógica específica para instância 2
  }, 'handler-instancia-2');
  
  // Adicionar handler adicional na instância 1
  whatsapp1.onMessage((message) => {
    if (message.message.includes('urgente')) {
      console.log('[Instância 1] ⚠️ Mensagem urgente detectada!');
    }
  }, 'urgente-handler');
  
  // Conectar ambas
  await Promise.all([
    whatsapp1.connect(),
    whatsapp2.connect()
  ]);
  
  // Aguardar conexões
  while (
    whatsapp1.getConnectionStatus() !== 'connected' ||
    whatsapp2.getConnectionStatus() !== 'connected'
  ) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Verificar handlers de cada instância
  console.log(`Instância 1 - Handlers: ${whatsapp1.getMessageHandlerCount()}`);
  console.log(`Instância 2 - Handlers: ${whatsapp2.getMessageHandlerCount()}`);
  console.log(`IDs dos handlers da instância 1:`, whatsapp1.getMessageHandlerIds());
  
  // Exemplo: remover um handler específico da instância 1
  // whatsapp1.offMessage('urgente-handler');
  
  // Exemplo: limpar todos os handlers de uma instância
  // whatsapp1.clearMessageHandlers();
  
  return { whatsapp1, whatsapp2 };
}

// Exemplo com callbacks de mensagens (substituindo o messageRepository)
export async function exemploComCallbacks() {
  const whatsapp = new BaileysService();

  // Callback para mensagens recebidas (inbound) - similar ao que o messageRepository fazia
  whatsapp.onInboundMessage((data) => {
    console.log('💾 [Callback Inbound] Salvando mensagem recebida:', {
      id: data.id,
      phoneNumber: data.phoneNumber,
      content: data.content,
      timestamp: data.timestamp,
      from: data.from,
    });
    // Aqui você pode salvar no banco de dados, fazer processamento, etc.
  }, 'save-inbound-messages');

  // Callback para mensagens enviadas (outbound) - similar ao que o messageRepository fazia
  whatsapp.onOutboundMessage((data) => {
    console.log('💾 [Callback Outbound] Salvando mensagem enviada:', {
      id: data.id,
      phoneNumber: data.phoneNumber,
      content: data.content,
      timestamp: data.timestamp,
      to: data.to,
    });
    // Aqui você pode salvar no banco de dados, fazer processamento, etc.
  }, 'save-outbound-messages');

  // Conectar
  await whatsapp.connect();

  // Aguardar conexão
  while (whatsapp.getConnectionStatus() !== 'connected') {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Handler de mensagem para processar a mensagem recebida
  whatsapp.onMessage((message) => {
    console.log(`Mensagem recebida: ${message.message}`);
  });

  // Enviar uma mensagem (vai disparar o callback onOutboundMessage)
  await whatsapp.sendMessage('5511999999999', 'Teste de callback');

  // Exemplo: remover um callback específico
  // whatsapp.offInboundMessage('save-inbound-messages');

  // Exemplo: limpar todos os callbacks
  // whatsapp.clearAllCallbacks();

  return whatsapp;
}

// Exemplo com callbacks de conexão e desconexão
export async function exemploComCallbacksConexao() {
  const whatsapp = new BaileysService();

  // Callback para quando a conexão é estabelecida
  whatsapp.onConnect(() => {
    console.log('✅ Conexão estabelecida!');
    // Aqui você pode fazer ações quando conectar, como notificar outros sistemas
  }, 'connect-handler');

  // Callback para quando a conexão é desconectada
  whatsapp.onDisconnect((reason) => {
    console.log(`❌ Conexão perdida. Motivo: ${reason}`);
    
    // Motivos possíveis:
    // - 'loggedOut': Usuário fez logout
    // - 'error_XXX': Erro com código específico
    // - 'manual': Desconexão manual
    // - 'unknown': Motivo desconhecido
    
    if (reason === 'loggedOut') {
      console.log('⚠️ Você precisa fazer login novamente');
    } else if (reason?.startsWith('error_')) {
      console.log('⚠️ Erro na conexão, tentando reconectar...');
    }
    
    // Aqui você pode fazer ações quando desconectar, como limpar cache, notificar, etc.
  }, 'disconnect-handler');

  // Conectar
  await whatsapp.connect();

  // Aguardar conexão
  while (whatsapp.getConnectionStatus() !== 'connected') {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Exemplo: desconectar manualmente após 10 segundos
  // setTimeout(async () => {
  //   await whatsapp.disconnect();
  // }, 10000);

  return whatsapp;
}
