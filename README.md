# Baileys Core

Serviço para integração com WhatsApp usando Baileys. Permite múltiplas conexões simultâneas, handlers de mensagem por instância e callbacks para processamento de mensagens.

## 📋 Índice

- [Instalação](#instalação)
- [Uso Básico](#uso-básico)
- [Autenticação por QR Code ou Número](#autenticação-por-qr-code-ou-número)
- [Múltiplas Instâncias](#múltiplas-instâncias)
- [Handlers de Mensagem](#handlers-de-mensagem)
- [Callbacks de Mensagens](#callbacks-de-mensagens)
- [Callbacks de Conexão e Desconexão](#callbacks-de-conexão-e-desconexão)
- [API Completa](#api-completa)
- [Estudo de Caso](#estudo-de-caso)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Exemplos](#exemplos)
- [Troubleshooting](#troubleshooting)

## 🚀 Instalação

```bash
npm install
```

### Configuração de Variáveis de Ambiente

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```

2. Edite o arquivo `.env` com suas configurações

Para mais detalhes sobre as variáveis disponíveis, consulte [ENV.md](./ENV.md).

## 📖 Uso Básico

### 1. Importar o serviço

```typescript
import { BaileysService, WhatsAppMessage } from './src/baileys-service.js';
```

### 2. Criar instância e conectar

```typescript
const whatsapp = new BaileysService();

// Conectar (padrão: fluxo com QR Code)
await whatsapp.connect({ authMethod: 'qr' });

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


## 🔐 Autenticação por QR Code ou Número

A API agora suporta dois modos de autenticação, e quem usa a biblioteca decide o fluxo:

- `authMethod: 'qr'` (padrão): gera QR Code para escanear no app do WhatsApp.
- `authMethod: 'phone'`: gera código de pareamento usando número de telefone (sem `+`, espaços ou símbolos).

### Fluxo 1: QR Code (mantido)

```typescript
const whatsapp = new BaileysService();

whatsapp.onQrCode((qr) => {
  console.log('QR gerado:', qr);
});

await whatsapp.connect({ authMethod: 'qr' });
```

### Fluxo 2: Número de telefone (pairing code)

```typescript
const whatsapp = new BaileysService();

whatsapp.onPairingCode((pairingCode) => {
  console.log('Código de pareamento:', pairingCode);
});

await whatsapp.connect({
  authMethod: 'phone',
  phoneNumber: '5511999999999',
});
```

### Endpoints HTTP (Dashboard Server)

- Conectar por QR: `POST /api/instances/:id/connect?authMethod=qr`
- Conectar por número: `POST /api/instances/:id/connect?authMethod=phone&phoneNumber=5511999999999`
- Ler QR atual: `GET /api/instances/:id/qr`
- Ler pairing code atual: `GET /api/instances/:id/pairing-code`

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

## 🔌 Callbacks de Conexão e Desconexão

Os callbacks de conexão e desconexão permitem monitorar o estado da conexão WhatsApp e reagir a mudanças.

### Callback de Conexão (`onConnect`)

```typescript
whatsapp.onConnect(() => {
  console.log('✅ Conexão estabelecida com sucesso!');
  // Executado quando a conexão é estabelecida
  // Aqui você pode fazer ações como notificar outros sistemas, atualizar status, etc.
}, 'connect-handler');
```

### Callback de Desconexão (`onDisconnect`)

```typescript
whatsapp.onDisconnect((reason) => {
  console.log(`❌ Conexão perdida. Motivo: ${reason}`);
  
  // Motivos possíveis:
  // - 'loggedOut': Usuário fez logout do WhatsApp
  // - 'error_XXX': Erro com código específico (ex: 'error_401', 'error_403')
  // - 'manual': Desconexão manual via disconnect()
  // - 'unknown': Motivo desconhecido
  
  if (reason === 'loggedOut') {
    console.log('⚠️ Você precisa fazer login novamente');
    // Gerar novo QR code: await whatsapp.generateNewQrCode();
  } else if (reason?.startsWith('error_')) {
    console.log('⚠️ Erro na conexão, tentando reconectar...');
    // O sistema tentará reconectar automaticamente
  }
  
  // Aqui você pode fazer ações como limpar cache, notificar sistemas, etc.
}, 'disconnect-handler');
```

### Gerenciar Callbacks de Conexão

```typescript
// Remover callbacks específicos
whatsapp.offConnect('connect-handler');
whatsapp.offDisconnect('disconnect-handler');

// Limpar todos os callbacks de um tipo
whatsapp.clearConnectCallbacks();
whatsapp.clearDisconnectCallbacks();

// Limpar todos os callbacks (incluindo conexão/desconexão)
whatsapp.clearAllCallbacks();
```

### Exemplo Completo com Callbacks de Conexão

```typescript
const whatsapp = new BaileysService();

// Callback de conexão
whatsapp.onConnect(() => {
  console.log('✅ Conectado ao WhatsApp!');
  // Notificar sistema externo, atualizar status no banco, etc.
}, 'connect-notifier');

// Callback de desconexão
whatsapp.onDisconnect((reason) => {
  console.log(`❌ Desconectado. Motivo: ${reason}`);
  
  if (reason === 'loggedOut') {
    // Usuário fez logout - precisa escanear QR code novamente
    console.log('⚠️ Faça login novamente');
  } else {
    // Erro ou desconexão - sistema tentará reconectar
    console.log('🔄 Tentando reconectar...');
  }
}, 'disconnect-handler');

// Conectar
await whatsapp.connect();

// Aguardar conexão
while (whatsapp.getConnectionStatus() !== 'connected') {
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Exemplo: desconectar manualmente após algum tempo
// setTimeout(async () => {
//   await whatsapp.disconnect(); // Isso disparará o callback com reason='manual'
// }, 60000);
```

### Callback de QR Code (`onQrCode`)

```typescript
whatsapp.onQrCode((qr) => {
  console.log('📱 QR Code gerado:', qr);
  // Você pode gerar uma imagem do QR code, enviar por email, etc.
  // O QR code também está disponível via getCurrentQrCode()
}, 'qrcode-handler');
```

### Gerar Novo QR Code Manualmente (`generateNewQrCode`)

Quando o usuário é deslogado (`loggedOut`), você pode gerar um novo QR code manualmente chamando este método. Ele limpa as credenciais antigas e reconecta para gerar um novo QR code.

```typescript
// Gerar novo QR code manualmente
await whatsapp.generateNewQrCode();
```

**Quando usar:**
- Quando o usuário foi deslogado (`reason === 'loggedOut'` no callback de desconexão)
- Quando você precisa forçar uma nova autenticação
- Quando as credenciais estão corrompidas ou inválidas

**O que o método faz:**
1. Desconecta se estiver conectado
2. Remove as credenciais antigas do diretório de autenticação
3. Reconecta automaticamente para gerar um novo QR code

**Exemplo com callback de desconexão:**

```typescript
whatsapp.onDisconnect((reason) => {
  console.log(`❌ Desconectado. Motivo: ${reason}`);
  
  if (reason === 'loggedOut') {
    console.log('⚠️ Usuário deslogado. Gerando novo QR code...');
    // Gerar novo QR code automaticamente quando deslogado
    await whatsapp.generateNewQrCode();
  } else if (reason?.startsWith('error_')) {
    console.log('⚠️ Erro na conexão, tentando reconectar...');
    // O sistema tentará reconectar automaticamente
  }
}, 'disconnect-handler');
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

##### `connect(options?: ConnectOptions): Promise<void>`
Conecta ao WhatsApp com autenticação configurável (`qr` ou `phone`).

**`ConnectOptions`**
- `authMethod?: 'qr' | 'phone'` (padrão: `'qr'`)
- `phoneNumber?: string` (obrigatório quando `authMethod='phone'`)

##### `disconnect(): Promise<void>`
Desconecta do WhatsApp.

##### `generateNewQrCode(): Promise<void>`
Gera um novo QR code manualmente, limpando as credenciais existentes. Útil quando o usuário foi deslogado e precisa fazer login novamente.

- Desconecta se estiver conectado
- Remove as credenciais antigas do diretório de autenticação
- Reconecta automaticamente para gerar um novo QR code

**Exemplo:**
```typescript
// Quando o usuário foi deslogado
whatsapp.onDisconnect((reason) => {
  if (reason === 'loggedOut') {
    await whatsapp.generateNewQrCode();
  }
});
```

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
Remove todos os callbacks (inbound, outbound, QR code, conexão e desconexão).

##### `onQrCode(callback, callbackId?): string`
Registra callback para quando um QR code for gerado.

- `callback`: Função `(qr: string) => void`
- `callbackId`: ID opcional
- Retorna: ID do callback

##### `offQrCode(callbackId: string): boolean`
Remove callback de QR code.

##### `getCurrentQrCode(): string | null`
Retorna o QR code atual (se disponível) ou `null`.

##### `onPairingCode(callback, callbackId?): string`
Registra callback para quando um código de pareamento for gerado no fluxo por número.

##### `offPairingCode(callbackId: string): boolean`
Remove callback de código de pareamento.

##### `getCurrentPairingCode(): string | null`
Retorna o código de pareamento atual (se disponível) ou `null`.

##### `onConnect(callback, callbackId?): string`
Registra callback para quando a conexão for estabelecida.

- `callback`: Função `() => void`
- `callbackId`: ID opcional
- Retorna: ID do callback

##### `offConnect(callbackId: string): boolean`
Remove callback de conexão.

##### `onDisconnect(callback, callbackId?): string`
Registra callback para quando a conexão for perdida.

- `callback`: Função `(reason?: string) => void`
  - `reason`: Motivo da desconexão:
    - `'loggedOut'`: Usuário fez logout
    - `'error_XXX'`: Erro com código específico
    - `'manual'`: Desconexão manual
    - `'unknown'`: Motivo desconhecido
- `callbackId`: ID opcional
- Retorna: ID do callback

##### `offDisconnect(callbackId: string): boolean`
Remove callback de desconexão.

##### `clearConnectCallbacks(): void`
Remove todos os callbacks de conexão.

##### `clearDisconnectCallbacks(): void`
Remove todos os callbacks de desconexão.

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
  chatId: string;          // JID da conversa (grupo ou contato)
  senderJid: string;       // JID real de quem enviou a mensagem
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

## ⚙️ Variáveis de Ambiente

O projeto suporta configuração via variáveis de ambiente. Consulte [ENV.md](./ENV.md) para documentação completa.

### Variáveis Principais

- `PORT`: Porta do servidor dashboard (padrão: `3000`)
- `DASHBOARD_HOST`: Host do dashboard (padrão: `localhost`)
- `AUTH_BASE_DIR`: Diretório base para autenticação (padrão: `.whatsapp-auth`)
- `LOG_LEVEL`: Nível de log (padrão: `silent`)
- `ENABLE_CORS`: Habilitar CORS (padrão: `true`)
- `MAX_INSTANCES`: Limite de instâncias (padrão: `0` = ilimitado)

### Exemplo Rápido

```bash
# Criar arquivo .env
cp .env.example .env

# Editar .env
PORT=8080
DASHBOARD_HOST=0.0.0.0
LOG_LEVEL=info
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

### Exemplo 4: Com Callbacks de Conexão e Desconexão

```typescript
import { BaileysService } from './src/baileys-service.js';

const whatsapp = new BaileysService();

// Callback quando conectar
whatsapp.onConnect(() => {
  console.log('✅ Conectado ao WhatsApp!');
  // Atualizar status no banco de dados, notificar sistemas, etc.
}, 'connect-handler');

// Callback quando desconectar
whatsapp.onDisconnect(async (reason) => {
  console.log(`❌ Desconectado. Motivo: ${reason}`);
  
  if (reason === 'loggedOut') {
    console.log('⚠️ Usuário deslogado. Gerando novo QR code...');
    // Gerar novo QR code automaticamente
    await whatsapp.generateNewQrCode();
  } else if (reason?.startsWith('error_')) {
    console.log('⚠️ Erro na conexão');
    // O sistema tentará reconectar automaticamente
  }
}, 'disconnect-handler');

// Callback para QR code
whatsapp.onQrCode((qr) => {
  console.log('📱 QR Code gerado');
  // Gerar imagem, enviar por email, etc.
}, 'qrcode-handler');

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
- Se o usuário foi deslogado, use `generateNewQrCode()` para gerar um novo QR code

### Múltiplas instâncias compartilhando credenciais
- Certifique-se de que cada instância usa um `authDir` diferente
- Cada instância deve ter seu próprio diretório de autenticação

### Handlers não são executados
- Verifique se a conexão está ativa: `getConnectionStatus() === 'connected'`
- Confirme que os handlers foram registrados: `getMessageHandlerCount() > 0`

## 📝 Notas Importantes

- **Primeira conexão**: Será necessário escanear o QR Code com o WhatsApp
- **Credenciais**: São salvas automaticamente no diretório especificado
- **Reconexão**: O serviço reconecta automaticamente em caso de desconexão (exceto quando `loggedOut`)
- **QR Code Manual**: Quando o usuário é deslogado, use `generateNewQrCode()` para gerar um novo QR code
- **Múltiplas instâncias**: Cada instância precisa de um número de WhatsApp diferente
- **Handlers**: Cada instância mantém seus próprios handlers e callbacks
- **Callbacks vs Handlers**: 
  - Callbacks são executados primeiro (úteis para salvar no banco)
  - Handlers são executados depois (úteis para processar a mensagem)
- **Callbacks de Conexão/Desconexão**: 
  - `onConnect`: Executado quando a conexão é estabelecida
  - `onDisconnect`: Executado quando a conexão é perdida (recebe motivo)
  - Úteis para monitorar estado da conexão e reagir a mudanças

## 📄 Licença

ISC

## 📘 Estudo de Caso

- [Autenticação QR + Número](./docs/estudo-caso-autenticacao-qr-e-numero.md)
