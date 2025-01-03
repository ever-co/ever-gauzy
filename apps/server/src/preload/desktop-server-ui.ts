import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import { app } from 'electron';
import * as os from 'os';

class ServerProcessFactory {
	public static createUiServerProcess(): ChildProcessWithoutNullStreams {
		const appPath = app.getPath('userData');
		const uiPath = this.prepareServerUi(appPath);
		console.log('UI Path:', uiPath);

		const uiService = spawn(uiPath, { detached: true, stdio: 'pipe' });

		uiService.stdout.on('data', (data) => {
			console.log('SERVER UI STATE LOGS -> ', data.toString());
		});

		uiService.stderr.on('data', (data) => {
			console.error('SERVER UI ERROR LOGS -> ', data.toString());
		});

		uiService.on('error', (error) => {
			console.error('Failed to start UI server:', error);
		});

		uiService.on('exit', (code, signal) => {
			console.log(`UI server exited with code ${code} and signal ${signal}`);
		});

		return uiService;
	}

	private static prepareServerUi(appPath: string): string {
		let appName = '';
		switch (os.platform()) {
			case 'win32':
				appName = `${process.env.NAME}.exe`;
				break;
			case 'darwin':
				appName = process.env.NAME || '';
				break;
			default:
				break;
		}
		return path.join(appPath, appName);
	}
}

class App {
	public static main(): void {
		try {
			ServerProcessFactory.createUiServerProcess();
		} catch (error) {
			console.error('[CRITICAL::ERROR]: Starting server:', error);
		}
	}
}

App.main();
