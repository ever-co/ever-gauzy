import { fork, ChildProcessWithoutNullStreams } from 'child_process';
import { LocalStore } from '@gauzy/desktop-lib';

interface IEnvApi {
	IS_ELECTRON: string;
	DB_PATH: string;
	DB_TYPE: string;
	DB_HOST?: string;
	DB_PORT?: string;
	DB_NAME?: string;
	DB_USER?: string;
	DB_PASS?: string;
	API_PORT: string;
	API_HOST: string;
	API_BASE_URL: string;
}

class ApiServerProcessFactory {
	public static createApiServerProcess(): ChildProcessWithoutNullStreams {
		try {
			const { apiPath, db, dbName, dbPassword, dbUsername, dbPort, port, dbPath, dbHost, apiBaseUrl, apiHost } =
				this.prepareServerApi();

			const apiEnv: IEnvApi = {
				IS_ELECTRON: 'true',
				DB_PATH: dbPath,
				DB_TYPE: db,
				DB_HOST: dbHost || '',
				DB_PORT: dbPort ? String(dbPort) : '',
				DB_NAME: dbName || '',
				DB_USER: dbUsername || '',
				DB_PASS: dbPassword || '',
				API_PORT: String(port),
				API_HOST: apiHost,
				API_BASE_URL: apiBaseUrl
			};

			const uiService = fork(apiPath, {
				silent: true,
				detached: true,
				env: {
					...process.env,
					...apiEnv
				}
			});

			uiService.stdout.on('data', (data) => {
				console.log('SERVER API STATE LOGS -> ', data.toString());
				uiService.unref();
				process.exit(0);
			});

			return uiService;
		} catch (error) {
			console.error('[CRITICAL::ERROR]: Running API server failed:', error);
		}
	}

	private static prepareServerApi(): {
		apiPath: string;
		db: string;
		dbPort: number | null;
		dbName: string | null;
		dbUsername: string | null;
		dbPassword: string | null;
		port: number;
		dbPath: string;
		dbHost: string | null;
		apiBaseUrl: string;
		apiHost: string;
	} {
		const { port, db, apiPath, dbPath, postgres, apiBaseUrl } = LocalStore.getStore('configs');

		return {
			apiPath,
			db,
			dbPort: postgres?.dbPort || null,
			dbName: postgres?.dbName || null,
			dbPassword: postgres?.dbPassword || null,
			dbUsername: postgres?.dbUsername || null,
			dbHost: postgres?.dbHost || null,
			port,
			dbPath,
			apiBaseUrl,
			apiHost: '0.0.0.0'
		};
	}
}

class App {
	public static main(): void {
		ApiServerProcessFactory.createApiServerProcess();
	}
}

export default function () {
	console.log('Before running API Server');
	App.main();
}
