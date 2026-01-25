# Baileys Core

Serviço para integração com WhatsApp usando Baileys. Permite múltiplas conexões simultâneas, handlers de mensagem por instância e callbacks para processamento de mensagens.

## 📋 Índice

- [Instalação](#instalação)
- [Uso Básico](#uso-básico)
- [Múltiplas Instâncias](#múltiplas-instâncias)
- [Handlers de Mensagem](#handlers-de-mensagem)
- [Callbacks de Mensagens](#callbacks-de-mensagens)
- [API Completa](#api-completa)
- [Exemplos](#exemplos)
- [Troubleshooting](#troubleshooting)

## 🚀 Instalação

```bash
npm install
```

## 📖 Uso Básico

### 1. Importar o serviço

```typescript
import { BaileysService, WhatsAppMessage } from './src/baileys-service.js';
```

### 2. Criar instância e conectar

```typescript
const whatsapp = new BaileysService();

// Conectar (irá mostrar QR Code no terminal)
await whatsapp.connect();

// Aguardar conexão
while (whatsapp.getConnectionStatus() !== 'connected') {
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### 3. Enviar mensagem

```typescript
// Número com código do país (sem + e sem @)
await whatsapp.sendMessage('5511999999999', 'Olá! Esta é uma mensagem.');
```

### 4. Escutar mensagens recebidas

```typescript
whatsapp.onMessage((message: WhatsAppMessage) => {
  console.log(`Mensagem de ${message.from}: ${message.message}`);
  
  // Responder automaticamente
  whatsapp.sendMessage(message.from, 'Resposta automática');
});
```

### 5. Desconectar

```typescript
await whatsapp.disconnect();
```

## 🔄 Múltiplas Instâncias

Você pode criar múltiplas instâncias do `BaileysService`, cada uma com sua própria conexão WhatsApp. Cada instância precisa de um diretório de autenticação único.

### Exemplo Básico

```typescript
import { BaileysService } from './src/baileys-service.js';
import { join } from 'path';

// Instância 1 - WhatsApp número 1
const whatsapp1 = new BaileysService(
  join(process.cwd(), '.whatsapp-auth-1'),
  'instancia-1' // ID opcional para identificação
);

// Instância 2 - WhatsApp número 2
const whatsapp2 = new BaileysService(
  join(process.cwd(), '.whatsapp-auth-2'),
  'instancia-2'
);

// Conectar ambas simultaneamente
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
```

### Usando o Gerenciador de Instâncias

```typescript
import { BaileysServiceManager } from './src/example-multiple-instances.js';

const manager = new BaileysServiceManager();

// Criar instâncias
const instance1 = manager.createInstance('cliente-1');
const instance2 = manager.createInstance('cliente-2');

// Conectar todas
await manager.connectAll();

// Obter uma instância específica
const cliente1 = manager.getInstance('cliente-1');
if (cliente1) {
  await cliente1.sendMessage('5511999999999', 'Olá!');
}

// Listar todas as instâncias
console.log(manager.listInstances());

// Desconectar uma instância específica
await manager.disconnectInstance('cliente-2');

// Desconectar todas
await manager.disconnectAll();
```

## 📨 Handlers de Mensagem

Cada instância pode ter múltiplos handlers de mensagem. Os handlers são executados quando uma mensagem é recebida.

### Registrar Handler

```typescript
// Handler com ID opcional
const handlerId = whatsapp.onMessage((message) => {
  console.log('Nova mensagem:', message.message);
}, 'meu-handler');

console.log(`Handler registrado com ID: ${handlerId}`);
```

### Múltiplos Handlers

```typescript
// Handler principal
whatsapp.onMessage((message) => {
  console.log(`[Principal] ${message.message}`);
}, 'handler-principal');

// Handler para mensagens urgentes
whatsapp.onMessage((message) => {
  if (message.message.includes('urgente')) {
    console.log('⚠️ Mensagem urgente!');
  }
}, 'handler-urgente');

// Handler para logging
whatsapp.onMessage((message) => {
  console.log(`[Log] Nova mensagem recebida`);
}, 'handler-log');
```

### Gerenciar Handlers

```typescript
// Remover um handler específico
whatsapp.offMessage('handler-log');

// Ver quantidade de handlers
console.log(`Handlers ativos: ${whatsapp.getMessageHandlerCount()}`);

// Listar IDs dos handlers
console.log('IDs dos handlers:', whatsapp.getMessageHandlerIds());

// Limpar todos os handlers
whatsapp.clearMessageHandlers();
```

### Handlers por Instância

Cada instância mantém seus próprios handlers:

```typescript
const whatsapp1 = new BaileysService('.auth-1', 'inst-1');
const whatsapp2 = new BaileysService('.auth-2', 'inst-2');

// Handlers diferentes para cada instância
whatsapp1.onMessage((msg) => {
  console.log('[Instância 1]', msg.message);
}, 'handler-1');

whatsapp2.onMessage((msg) => {
  console.log('[Instância 2]', msg.message);
}, 'handler-2');
```

## 🔔 Callbacks de Mensagens

Os callbacks permitem processar mensagens antes dos handlers serem executados. Úteis para salvar no banco de dados, fazer logging, etc.

### Callback para Mensagens Recebidas (Inbound)

```typescript
import { InboundMessageData } from './src/baileys-service.js';

whatsapp.onInboundMessage((data: InboundMessageData) => {
  console.log('💾 Mensagem recebida:', {
    id: data.id,
    phoneNumber: data.phoneNumber,
    content: data.content,
    timestamp: data.timestamp,
    from: data.from,
  });
  
  // Salvar no banco de dados
  // await database.saveMessage(data);
}, 'save-inbound-messages');
```

**Interface `InboundMessageData`:**
- `id`: ID da mensagem
- `phoneNumber`: Número de telefone (sem @s.whatsapp.net)
- `direction`: 'inbound'
- `content`: Conteúdo da mensagem
- `timestamp`: Data/hora da mensagem
- `from`: JID completo do remetente
- `messageId`: ID da mensagem (opcional)

### Callback para Mensagens Enviadas (Outbound)

```typescript
import { OutboundMessageData } from './src/baileys-service.js';

whatsapp.onOutboundMessage((data: OutboundMessageData) => {
  console.log('💾 Mensagem enviada:', {
    id: data.id,
    phoneNumber: data.phoneNumber,
    content: data.content,
    timestamp: data.timestamp,
    to: data.to,
  });
  
  // Salvar no banco de dados
  // await database.saveMessage(data);
}, 'save-outbound-messages');
```

**Interface `OutboundMessageData`:**
- `id`: ID da mensagem
- `phoneNumber`: Número de telefone (sem @s.whatsapp.net)
- `direction`: 'outbound'
- `content`: Conteúdo da mensagem
- `timestamp`: Data/hora da mensagem
- `to`: JID completo do destinatário

### Gerenciar Callbacks

```typescript
// Remover callback específico
whatsapp.offInboundMessage('save-inbound-messages');
whatsapp.offOutboundMessage('save-outbound-messages');

// Limpar todos os callbacks de um tipo
whatsapp.clearInboundMessageCallbacks();
whatsapp.clearOutboundMessageCallbacks();

// Limpar todos os callbacks
whatsapp.clearAllCallbacks();
```

### Exemplo Completo com Callbacks

```typescript
const whatsapp = new BaileysService();

// Callback para salvar mensagens recebidas
whatsapp.onInboundMessage((data) => {
  // Salvar no banco de dados
  console.log('Salvando mensagem recebida:', data);
}, 'db-save-inbound');

// Callback para salvar mensagens enviadas
whatsapp.onOutboundMessage((data) => {
  // Salvar no banco de dados
  console.log('Salvando mensagem enviada:', data);
}, 'db-save-outbound');

// Handler para processar mensagens
whatsapp.onMessage((message) => {
  console.log('Processando mensagem:', message.message);
  
  // Responder automaticamente
  if (message.message.toLowerCase().includes('oi')) {
    whatsapp.sendMessage(message.from, 'Olá! Como posso ajudar?');
  }
});

await whatsapp.connect();
```

## 📚 API Completa

### `BaileysService`

#### Construtor

```typescript
constructor(authDir?: string, instanceId?: string)
```

- `authDir`: Diretório para armazenar credenciais (padrão: `.whatsapp-auth`)
- `instanceId`: ID opcional para identificar a instância nos logs

#### Métodos de Conexão

##### `connect(): Promise<void>`
Conecta ao WhatsApp. Mostra QR Code no terminal na primeira conexão.

##### `disconnect(): Promise<void>`
Desconecta do WhatsApp.

##### `getConnectionStatus(): WhatsAppConnectionStatus`
Retorna o status atual da conexão:
- `'connecting'`: Conectando
- `'connected'`: Conectado
- `'disconnected'`: Desconectado
- `'error'`: Erro na conexão

#### Métodos de Mensagem

##### `sendMessage(to: string, message: string): Promise<void>`
Envia uma mensagem de texto.

- `to`: Número com código do país (ex: `'5511999999999'`) ou JID completo
- `message`: Texto da mensagem

##### `onMessage(handler, handlerId?): string`
Registra um handler para mensagens recebidas.

- `handler`: Função callback `(message: WhatsAppMessage) => void`
- `handlerId`: ID opcional para identificar o handler
- Retorna: ID do handler

##### `offMessage(handlerId: string): boolean`
Remove um handler específico.

##### `clearMessageHandlers(): void`
Remove todos os handlers de mensagem.

##### `getMessageHandlerCount(): number`
Retorna a quantidade de handlers registrados.

##### `getMessageHandlerIds(): string[]`
Retorna array com IDs de todos os handlers.

#### Métodos de Callbacks

##### `onInboundMessage(callback, callbackId?): string`
Registra callback para mensagens recebidas.

- `callback`: Função `(data: InboundMessageData) => void`
- `callbackId`: ID opcional
- Retorna: ID do callback

##### `offInboundMessage(callbackId: string): boolean`
Remove callback de mensagem recebida.

##### `onOutboundMessage(callback, callbackId?): string`
Registra callback para mensagens enviadas.

- `callback`: Função `(data: OutboundMessageData) => void`
- `callbackId`: ID opcional
- Retorna: ID do callback

##### `offOutboundMessage(callbackId: string): boolean`
Remove callback de mensagem enviada.

##### `clearInboundMessageCallbacks(): void`
Remove todos os callbacks de mensagem recebida.

##### `clearOutboundMessageCallbacks(): void`
Remove todos os callbacks de mensagem enviada.

##### `clearAllCallbacks(): void`
Remove todos os callbacks (inbound e outbound).

#### Métodos de Instância

##### `getInstanceId(): string | undefined`
Retorna o ID da instância.

##### `setInstanceId(instanceId: string): void`
Define o ID da instância.

### Interfaces

#### `WhatsAppMessage`
```typescript
interface WhatsAppMessage {
  from: string;           // JID do remetente
  message: string;         // Texto da mensagem
  timestamp: Date;         // Data/hora
  messageId?: string;      // ID da mensagem (opcional)
}
```

#### `InboundMessageData`
```typescript
interface InboundMessageData {
  id: string;             // ID da mensagem
  phoneNumber: string;     // Número sem @s.whatsapp.net
  direction: 'inbound';    // Direção
  content: string;         // Conteúdo
  timestamp: Date;          // Data/hora
  from: string;            // JID completo
  messageId?: string;       // ID da mensagem (opcional)
}
```

#### `OutboundMessageData`
```typescript
interface OutboundMessageData {
  id: string;             // ID da mensagem
  phoneNumber: string;     // Número sem @s.whatsapp.net
  direction: 'outbound';  // Direção
  content: string;         // Conteúdo
  timestamp: Date;         // Data/hora
  to: string;              // JID completo do destinatário
}
```

## 💡 Exemplos

### Exemplo 1: Uso Básico

```typescript
import { BaileysService } from './src/baileys-service.js';

const whatsapp = new BaileysService();

await whatsapp.connect();

// Aguardar conexão
while (whatsapp.getConnectionStatus() !== 'connected') {
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Enviar mensagem
await whatsapp.sendMessage('5511999999999', 'Olá!');

// Escutar mensagens
whatsapp.onMessage((message) => {
  console.log(`De ${message.from}: ${message.message}`);
});
```

### Exemplo 2: Múltiplas Instâncias

```typescript
import { BaileysService } from './src/baileys-service.js';
import { join } from 'path';

const whatsapp1 = new BaileysService('.auth-1', 'inst-1');
const whatsapp2 = new BaileysService('.auth-2', 'inst-2');

// Handlers diferentes para cada instância
whatsapp1.onMessage((msg) => {
  console.log('[Instância 1]', msg.message);
});

whatsapp2.onMessage((msg) => {
  console.log('[Instância 2]', msg.message);
});

await Promise.all([
  whatsapp1.connect(),
  whatsapp2.connect()
]);
```

### Exemplo 3: Com Callbacks

```typescript
import { BaileysService } from './src/baileys-service.js';

const whatsapp = new BaileysService();

// Salvar mensagens recebidas
whatsapp.onInboundMessage((data) => {
  console.log('Salvando mensagem recebida:', data);
  // await database.save(data);
}, 'save-inbound');

// Salvar mensagens enviadas
whatsapp.onOutboundMessage((data) => {
  console.log('Salvando mensagem enviada:', data);
  // await database.save(data);
}, 'save-outbound');

// Processar mensagens
whatsapp.onMessage((message) => {
  if (message.message.includes('help')) {
    whatsapp.sendMessage(message.from, 'Como posso ajudar?');
  }
});

await whatsapp.connect();
```

### Executar Exemplos

```bash
# Exemplo básico
npm run example

# Exemplo com múltiplas instâncias
npm run example:multiple

# Compilar manualmente
npm run build
node dist/run-example.js
```

## 🔧 Troubleshooting

### QR Code não aparece
- Certifique-se de que o terminal suporta exibição de QR Code
- Verifique se há erros no console

### Erro ao conectar
- Verifique se o diretório de autenticação existe e tem permissões de escrita
- Tente remover o diretório `.whatsapp-auth` e reconectar

### Múltiplas instâncias compartilhando credenciais
- Certifique-se de que cada instância usa um `authDir` diferente
- Cada instância deve ter seu próprio diretório de autenticação

### Handlers não são executados
- Verifique se a conexão está ativa: `getConnectionStatus() === 'connected'`
- Confirme que os handlers foram registrados: `getMessageHandlerCount() > 0`

## 📝 Notas Importantes

- **Primeira conexão**: Será necessário escanear o QR Code com o WhatsApp
- **Credenciais**: São salvas automaticamente no diretório especificado
- **Reconexão**: O serviço reconecta automaticamente em caso de desconexão
- **Múltiplas instâncias**: Cada instância precisa de um número de WhatsApp diferente
- **Handlers**: Cada instância mantém seus próprios handlers e callbacks
- **Callbacks vs Handlers**: 
  - Callbacks são executados primeiro (úteis para salvar no banco)
  - Handlers são executados depois (úteis para processar a mensagem)

## 📄 Licença

ISC
