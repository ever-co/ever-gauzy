import { loadEnv } from './load-env';

// Load environment variables
console.log('Loading Environment Variables...');
loadEnv();
console.log('Environment Variables Loaded');

console.time('✔ Total API Startup Time');

// Import bootstrap
console.time('✔ Bootstrap Import Time');
import { bootstrap } from './bootstrap';
console.timeEnd('✔ Bootstrap Import Time');
console.log('API Core Bootstrap Loaded');

// Import dev-config
console.time('✔ Dev Config Import Time');
import { devConfig } from './dev-config';
console.timeEnd('✔ Dev Config Import Time');
console.log('API Core Dev Config Loaded');

(async () => {
	try {
		console.log('API Core Starting...');
		await bootstrap(devConfig);
		console.log('API Core is running...');
	} catch (error) {
		console.error('Error during API Core startup:', error);
		process.exit(1); // Exit the process with a failure code
	}

	console.timeEnd('✔ Total API Startup Time');
})();
