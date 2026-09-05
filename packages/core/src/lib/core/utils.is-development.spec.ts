jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import { environment } from '@gauzy/config';
import { isDevelopment } from './utils';

describe('isDevelopment', () => {
	const originalNodeEnv = process.env.NODE_ENV;
	const originalProduction = environment.production;

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
		(environment as { production: boolean }).production = originalProduction;
	});

	it('is true for a development runtime on a non-production build', () => {
		process.env.NODE_ENV = 'development';
		(environment as { production: boolean }).production = false;
		expect(isDevelopment()).toBe(true);
	});

	it.each(['production', 'staging', 'test', undefined])('is false when NODE_ENV is %s', (nodeEnv) => {
		if (nodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = nodeEnv;
		(environment as { production: boolean }).production = false;
		expect(isDevelopment()).toBe(false);
	});

	it('is false on a production build even when NODE_ENV says development', () => {
		process.env.NODE_ENV = 'development';
		(environment as { production: boolean }).production = true;
		expect(isDevelopment()).toBe(false);
	});
});
