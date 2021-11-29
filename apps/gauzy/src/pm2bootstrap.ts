require('dotenv').config();
const pm2 = require('pm2');

const PRIVATE_KEY = process.env.KEYMETRICS_SECRET_KEY || '';
const PUBLIC_KEY = process.env.KEYMETRICS_PUBLIC_KEY || '';
const appName = process.env.PM2_APP_NAME || 'Gauzy';
const instances = process.env.WEB_CONCURRENCY || 1;
const maxMemory = process.env.WEB_MEMORY || 4096;
const port = process.env.WEB_PORT || 4250;

pm2.connect(function () {
	pm2.start(
		{
			script: './apps/gauzy/app.js',
			name: appName, // ----> THESE ATTRIBUTES ARE OPTIONAL:
			exec_mode: 'fork', // ----> https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#schema
			instances,
			max_memory_restart: maxMemory + 'M', // Auto restart if process taking more than XXmo
			env: {
				// If needed declare some environment variables
				NODE_ENV: 'production',
				WEB_PORT: port,
				KEYMETRICS_PUBLIC: PUBLIC_KEY,
				KEYMETRICS_SECRET: PRIVATE_KEY
			},
			post_update: ['yarn install'] // Commands to execute once we do a pull from Keymetrics
		},
		function () {
			pm2.dump(console.error);
			// Display logs in standard output
			pm2.launchBus(function (err, bus) {
				console.log('[PM2] Log streaming started');

				bus.on('log:out', function (packet) {
					console.log(
						'[App:%s] %s',
						packet.process.name,
						packet.data
					);
				});

				bus.on('log:err', function (packet) {
					console.error(
						'[App:%s][Err] %s',
						packet.process.name,
						packet.data
					);
				});
			});
		}
	);
});
