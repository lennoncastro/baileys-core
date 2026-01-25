import { exemploMultiplasInstancias, exemploComGerenciador } from './example-multiple-instances.js';

// Escolha qual exemplo executar:
// - exemploMultiplasInstancias: exemplo básico com 3 instâncias
// - exemploComGerenciador: exemplo usando o BaileysServiceManager

// Executar exemplo com múltiplas instâncias
exemploMultiplasInstancias().catch(console.error);

// Ou executar exemplo com gerenciador:
// exemploComGerenciador().catch(console.error);
