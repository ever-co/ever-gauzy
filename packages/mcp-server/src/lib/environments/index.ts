import { IEnvironment } from './ienvironment';

// Determine environment based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';

let environment: IEnvironment;

try {
	if (isProduction) {
		const { environment: prodEnvironment } = require('./environment.prod');
		environment = prodEnvironment;
	} else {
		const { environment: devEnvironment } = require('./environment');
		environment = devEnvironment;
	}
} catch (error) {
	if (process.env.NODE_ENV === 'development') {
		console.error('Failed to load environment configuration:', error);
	} else {
		console.error('Failed to load environment configuration');
	}
	throw new Error('Could not initialize environment configuration');
}

export { environment };
export type { IEnvironment };
