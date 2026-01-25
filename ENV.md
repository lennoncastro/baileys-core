# Variáveis de Ambiente

Este documento descreve todas as variáveis de ambiente disponíveis no projeto Baileys Core.

## Configuração Inicial

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edite o arquivo `.env` com suas configurações

## Variáveis Disponíveis

### `PORT`
- **Descrição**: Porta do servidor dashboard
- **Tipo**: Número
- **Padrão**: `3000`
- **Exemplo**: `PORT=3000`

### `AUTH_BASE_DIR`
- **Descrição**: Diretório base para autenticação do WhatsApp. Cada instância terá seu próprio subdiretório.
- **Tipo**: String (caminho)
- **Padrão**: `.whatsapp-auth`
- **Exemplo**: `AUTH_BASE_DIR=.whatsapp-auth`

### `DASHBOARD_HOST`
- **Descrição**: Host do dashboard. Use `0.0.0.0` para permitir acesso externo.
- **Tipo**: String
- **Padrão**: `localhost`
- **Exemplo**: 
  - `DASHBOARD_HOST=localhost` (apenas local)
  - `DASHBOARD_HOST=0.0.0.0` (acesso externo)

### `LOG_LEVEL`
- **Descrição**: Nível de log do sistema
- **Tipo**: String
- **Padrão**: `silent`
- **Valores possíveis**: `silent`, `error`, `warn`, `info`, `debug`
- **Exemplo**: `LOG_LEVEL=info`

### `RECONNECT_TIMEOUT`
- **Descrição**: Timeout para reconexão automática em milissegundos
- **Tipo**: Número
- **Padrão**: `5000` (5 segundos)
- **Exemplo**: `RECONNECT_TIMEOUT=5000`

### `DASHBOARD_UPDATE_INTERVAL`
- **Descrição**: Intervalo de atualização do dashboard em milissegundos
- **Tipo**: Número
- **Padrão**: `1000` (1 segundo)
- **Exemplo**: `DASHBOARD_UPDATE_INTERVAL=1000`

### `ENABLE_CORS`
- **Descrição**: Habilitar CORS no dashboard
- **Tipo**: Boolean (`true`/`false` ou `1`/`0`)
- **Padrão**: `true`
- **Exemplo**: `ENABLE_CORS=true`

### `CORS_ORIGINS`
- **Descrição**: Domínios permitidos para CORS. Use `*` para permitir todos ou liste separados por vírgula.
- **Tipo**: String (separado por vírgula)
- **Padrão**: `*`
- **Exemplo**: 
  - `CORS_ORIGINS=*` (todos)
  - `CORS_ORIGINS=http://localhost:3000,https://meusite.com`

### `INSTANCE_PREFIX`
- **Descrição**: Prefixo opcional para IDs de instâncias. Útil para organizar instâncias por ambiente (dev, prod, etc).
- **Tipo**: String
- **Padrão**: `` (vazio)
- **Exemplo**: 
  - `INSTANCE_PREFIX=prod` (instâncias serão: `prod-cliente-1`, `prod-cliente-2`)
  - `INSTANCE_PREFIX=dev` (instâncias serão: `dev-cliente-1`, `dev-cliente-2`)

### `MAX_INSTANCES`
- **Descrição**: Número máximo de instâncias simultâneas. Use `0` para ilimitado.
- **Tipo**: Número
- **Padrão**: `0` (ilimitado)
- **Exemplo**: 
  - `MAX_INSTANCES=0` (sem limite)
  - `MAX_INSTANCES=10` (máximo 10 instâncias)

## Exemplos de Configuração

### Desenvolvimento Local
```env
PORT=3000
DASHBOARD_HOST=localhost
LOG_LEVEL=debug
ENABLE_CORS=true
CORS_ORIGINS=*
INSTANCE_PREFIX=dev
```

### Produção
```env
PORT=8080
DASHBOARD_HOST=0.0.0.0
LOG_LEVEL=error
ENABLE_CORS=true
CORS_ORIGINS=https://meusite.com,https://app.meusite.com
INSTANCE_PREFIX=prod
MAX_INSTANCES=50
```

### Teste
```env
PORT=3001
DASHBOARD_HOST=localhost
LOG_LEVEL=info
INSTANCE_PREFIX=test
MAX_INSTANCES=5
```

## Notas Importantes

- O arquivo `.env` está no `.gitignore` e não será commitado
- Sempre use `.env.example` como referência
- Variáveis não definidas usarão os valores padrão
- Reinicie o servidor após alterar variáveis de ambiente
- Valores booleanos podem ser `true`/`false` ou `1`/`0`
