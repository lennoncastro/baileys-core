# Estudo de Caso: Autenticação WhatsApp com Baileys (QR + Número)

## Contexto

Times que usam Baileys normalmente começam com QR Code, mas em operação B2B também é comum precisar do fluxo por número (pairing code) para onboarding remoto e assistido.

Este projeto foi evoluído para suportar os dois modos simultaneamente, mantendo compatibilidade retroativa:

- QR Code continua sendo o padrão (`authMethod='qr'`)
- Pairing por número foi adicionado (`authMethod='phone'` + `phoneNumber`)

## Problema de Negócio

Antes, a API só cobria o fluxo com QR.

Isso limitava cenários como:

- Provisionamento com suporte remoto
- Operação em ambiente sem câmera disponível
- Fluxos automatizados de ativação assistida

## Solução Implementada

A API foi projetada para deixar a escolha com quem consome a biblioteca:

```ts
await service.connect({ authMethod: 'qr' });
// ou
await service.connect({ authMethod: 'phone', phoneNumber: '5511999999999' });
```

### Decisões técnicas

1. **Não quebrar quem já usa QR**
   - `connect()` continua funcionando sem parâmetros, assumindo QR.
2. **Fluxo por número controlado por opção explícita**
   - Exige `phoneNumber` quando `authMethod='phone'`.
3. **Observabilidade para os dois fluxos**
   - `onQrCode`/`getCurrentQrCode`
   - `onPairingCode`/`getCurrentPairingCode`
4. **Dashboard/API HTTP com paridade**
   - Endpoint de conexão aceita query params para modo de autenticação.
   - Endpoint específico para consultar `pairing-code`.

## API pronta para consumo

### Biblioteca

- `connect(options?: ConnectOptions)`
- `ConnectOptions.authMethod: 'qr' | 'phone'`
- `ConnectOptions.phoneNumber` (obrigatório no modo `phone`)
- `onPairingCode(callback)`
- `offPairingCode(callbackId)`
- `getCurrentPairingCode()`

### HTTP (Dashboard Server)

- `POST /api/instances/:id/connect?authMethod=qr`
- `POST /api/instances/:id/connect?authMethod=phone&phoneNumber=5511999999999`
- `GET /api/instances/:id/qr`
- `GET /api/instances/:id/pairing-code`

## Resultado

Agora o projeto tem uma camada de conexão mais flexível para WhatsApp:

- Sem remover o QR Code
- Com opção por número de telefone
- Com documentação e API para adoção imediata

Assim, cada integrador escolhe o melhor fluxo por contexto operacional.
