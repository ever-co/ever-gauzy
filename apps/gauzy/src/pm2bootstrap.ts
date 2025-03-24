import * as dotenv from 'dotenv';
dotenv.config();

import pm2 from 'pm2';

const PRIVATE_KEY = process.env.PM2_SECRET_KEY || '';
const PUBLIC_KEY = process.env.PM2_PUBLIC_KEY || '';
const appName = process.env.PM2_APP_NAME || 'Gauzy';
const instances = Number(process.env.WEB_CONCURRENCY) || 1;
const maxMemory = process.env.WEB_MEMORY ? `${process.env.WEB_MEMORY}M` : '4096M';
const port = Number(process.env.WEB_PORT) || 4250;

if (!PRIVATE_KEY || !PUBLIC_KEY) {
	console.error('ERROR: PM2_SECRET_KEY or PM2_PUBLIC_KEY is not set in your environment variables.');
	process.exit(1);
}

pm2.connect(function (err: any) {
	if (err) {
		console.error('[PM2] Connection failed:', err);
		process.exit(1);
	}

	// Start the application with PM2
	pm2.start(
		{
			script: './apps/gauzy/app.ts', // Ensure the path to your app is correct
			name: appName,
			exec_mode: 'fork',
			instances: instances,
			max_memory_restart: maxMemory, // Restart app if memory exceeds the limit
			env: {
				NODE_ENV: 'production',
				WEB_PORT: port.toString(),
				PM2_PUBLIC_KEY: PUBLIC_KEY,
				PM2_SECRET_KEY: PRIVATE_KEY,
				KEYMETRICS_PUBLIC: PUBLIC_KEY,
				KEYMETRICS_SECRET: PRIVATE_KEY
			}
		},
		function (startErr: any) {
			if (startErr) {
				console.error('[PM2] Error starting application:', startErr);
				process.exit(1);
			}

			console.log('[PM2] Application started successfully');

			// Display logs in standard output
			pm2.launchBus(function (busErr: any, bus: any) {
				if (busErr) {
					console.error('[PM2] Error launching bus:', busErr);
					process.exit(1);
				}
				console.log('[PM2] Log streaming started');

				// Log stdout and stderr from the application
				bus.on('log:out', function (packet: any) {
					console.log('[App:%s] %s', packet.process.name, packet.data);
				});

				bus.on('log:err', function (packet: any) {
					console.error('[App:%s][Err] %s', packet.process.name, packet.data);
				});
			});
		}
	);
});
