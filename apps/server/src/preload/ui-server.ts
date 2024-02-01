import { ServerManager } from './server-manager';

class App {
	public static main(): void {
		try {
			const portUi = process.env.UI_PORT ? Number(process.env.UI_PORT) : 4200;
			const serverManager = new ServerManager();

			serverManager.runServer(portUi);
		} catch (error) {
			console.error('[CRITICAL::ERROR]: Starting server:', error);
		}
	}
}

// Call the function to start the server when this module is executed
App.main();
