# Baileys Core

Serviço para integração com WhatsApp usando Baileys.

## Instalação

```bash
npm install
```

## Uso Básico

### 1. Importar o serviço

```typescript
import { BaileysService } from './src/baileys-service.js';
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
whatsapp.onMessage((message) => {
  console.log(`Mensagem de ${message.from}: ${message.message}`);
  
  // Responder automaticamente
  whatsapp.sendMessage(message.from, 'Resposta automática');
});
```

### 5. Desconectar

```typescript
await whatsapp.disconnect();
```

## Exemplos Completos

Veja o arquivo `src/example.ts` para exemplos mais detalhados.

## Executar Exemplos

```bash
# Opção 1: Usar npm scripts (recomendado)
npm run dev

# Opção 2: Compilar e executar manualmente
npm run build
npm run start

# Ou diretamente:
npx tsc
node dist/run-example.js
```

## API

### `BaileysService`

#### Métodos

- `connect()`: Conecta ao WhatsApp (mostra QR Code)
- `sendMessage(to, message, rfqId?, quoteId?)`: Envia mensagem
- `onMessage(handler)`: Registra handler para mensagens recebidas
- `getConnectionStatus()`: Retorna status da conexão
- `disconnect()`: Desconecta do WhatsApp
- `setMessageRepository(repository)`: Configura repositório para salvar mensagens

#### Status da Conexão

- `'connecting'`: Conectando
- `'connected'`: Conectado
- `'disconnected'`: Desconectado
- `'error'`: Erro na conexão

## Autenticação

As credenciais do WhatsApp são salvas automaticamente no diretório `.whatsapp-auth` (ou no diretório especificado no construtor).

## Notas

- Na primeira execução, será necessário escanear o QR Code com o WhatsApp
- As credenciais são salvas automaticamente para reconexões futuras
- O serviço reconecta automaticamente em caso de desconexão
