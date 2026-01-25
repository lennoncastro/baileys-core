import { DashboardServer } from './dashboard-server.js';
import { appConfig } from './config.js';

const server = new DashboardServer(appConfig.port, appConfig.dashboardHost);

server.start();

// Criar algumas instâncias de exemplo (opcional)
// const manager = server.getManager();
// manager.createInstance('exemplo-1');
// manager.createInstance('exemplo-2');

console.log(`\n💡 Dica: Acesse http://${appConfig.dashboardHost}:${appConfig.port} no seu navegador\n`);
