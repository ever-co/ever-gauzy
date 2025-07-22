import { IEnvironment } from './ienvironment.js';

// Determine environment based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';

let environment: IEnvironment;

try {
	if (isProduction) {
		const { environment: prodEnvironment } = await import('./environment.prod.js');
		environment = prodEnvironment;
	} else {
		const { environment: devEnvironment } = await import('./environment.js');
		environment = devEnvironment;
	}
} catch (error) {
	console.error('Failed to load environment configuration:', error);
	throw new Error('Could not initialize environment configuration');
}

export { environment };
export type { IEnvironment };
