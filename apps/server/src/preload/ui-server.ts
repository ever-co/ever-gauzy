import { ServerManager } from './server-manager';

class App {
	public static main(): void {
		try {
			const portUi = process.env.UI_PORT ? Number(process.env.UI_PORT) : 4200;
			// Set by the launcher from the LAN access setting; without it, only this computer can connect.
			const hostUi = process.env.UI_HOST || '127.0.0.1';
			const serverManager = new ServerManager();

			serverManager.runServer(portUi, hostUi);
		} catch (error) {
			console.error('[CRITICAL::ERROR]: Starting server:', error);
		}
	}
}

// Call the function to start the server when this module is executed
App.main();
