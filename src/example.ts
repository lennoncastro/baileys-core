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
  
  // 5. Escutar mensagens recebidas
  whatsapp.onMessage((message: WhatsAppMessage) => {
    console.log(`Mensagem recebida de ${message.from}:`);
    console.log(`  Texto: ${message.message}`);
    console.log(`  Timestamp: ${message.timestamp}`);
    
    // Exemplo: responder automaticamente
    if (message.message.toLowerCase().includes('oi')) {
      whatsapp.sendMessage(message.from, 'Olá! Como posso ajudar?');
    }
  });
  
  // 6. Desconectar (quando necessário)
  // await whatsapp.disconnect();
}

// Exemplo com repositório de mensagens
export async function exemploComRepositorio() {
  const whatsapp = new BaileysService();
  
  // Criar um repositório simples (você pode implementar o seu)
  const messageRepository = {
    save: (message: any) => {
      console.log('💾 Salvando mensagem:', message);
      // Aqui você salvaria no banco de dados
    },
    findLatestByPhoneNumber: (phoneNumber: string) => {
      console.log('🔍 Buscando última mensagem de:', phoneNumber);
      // Retornar última mensagem do banco de dados
      return undefined;
    },
    updateRfqId: (messageId: string, rfqId: string) => {
      console.log(`🔄 Atualizando RFQ ID: ${messageId} -> ${rfqId}`);
      // Atualizar no banco de dados
      return true;
    }
  };
  
  // Configurar o repositório
  whatsapp.setMessageRepository(messageRepository);
  
  // Conectar
  await whatsapp.connect();
  
  // Aguardar conexão
  while (whatsapp.getConnectionStatus() !== 'connected') {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Enviar mensagem com RFQ ID
  await whatsapp.sendMessage(
    '5511999999999',
    'Sua mensagem aqui',
    'RFQ-12345', // RFQ ID opcional
    'quote-id-123' // Quote ID opcional
  );
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
