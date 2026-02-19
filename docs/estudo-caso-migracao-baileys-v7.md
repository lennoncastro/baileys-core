# Estudo de caso: adequação ao Baileys v7 (foco em identificar o número do remetente)

## Contexto
Hoje o projeto já usa `@whiskeysockets/baileys` em versão `^7.0.0-rc.9`, mas a lógica de identificação de número ainda tratava `remoteJid` como se sempre fosse o telefone do remetente.

Isso funciona em conversa 1:1, mas em grupos `remoteJid` é o JID do grupo e **não** o número de quem enviou a mensagem.

## Problema principal encontrado
No arquivo `src/baileys-service.ts`, no evento `messages.upsert`, o número era extraído assim:

- base: `message.key.remoteJid`
- limpeza: remoção de sufixos `@s.whatsapp.net` e `@c.us`

Impacto:
- Em grupos, o `phoneNumber` salvo era incorreto (JID do grupo).
- Fica difícil auditar, responder automaticamente e persistir corretamente o remetente real.

## Ajuste proposto (e aplicado)
Foi implementada uma separação explícita entre:

- `chatId`: JID da conversa (pessoa ou grupo)
- `senderJid`: JID real de quem enviou a mensagem
- `phoneNumber`: número normalizado derivado de `senderJid`

### Regras de resolução adotadas
1. Se existir `message.key.participant`, ele representa o remetente real (caso comum em grupos).
2. Caso contrário, usar `message.key.remoteJid` (caso típico 1:1).
3. Para extrair o número:
   - remover o domínio após `@`
   - remover metadados após `:` (quando existir)

## Alterações no contrato de dados inbound
A interface `InboundMessageData` recebeu dois novos campos:

- `chatId: string`
- `senderJid: string`

Com isso, consumidores podem:
- persistir **conversa** e **autor** separadamente;
- responder no chat correto (`chatId`);
- rastrear o remetente real (`senderJid` / `phoneNumber`).

## Pontos de compatibilidade
- Campo `from` foi mantido para não quebrar integrações atuais (continua como JID da conversa).
- Campo `phoneNumber` continua existindo, agora com extração mais robusta.

## Checklist de migração para o time
1. Revisar consumidores de `onInboundMessage` para usar `senderJid` quando a regra depender do autor.
2. Se a automação responde no mesmo chat, usar `chatId`.
3. No banco, separar colunas:
   - `chat_id`
   - `sender_jid`
   - `sender_phone_number`
4. Atualizar relatórios que antes assumiam `from === remetente`.
5. Criar teste de integração com mensagem em grupo para validar mapeamento.

## Resultado esperado
Com a mudança, o projeto fica alinhado com o padrão de eventos da linha v7 no que mais causa erro em produção: distinguir corretamente **conversa** versus **remetente** no `messages.upsert`.
