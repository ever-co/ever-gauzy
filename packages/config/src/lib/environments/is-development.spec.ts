jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import { isDevelopment as exportedIsDevelopment } from '@gauzy/config';
import { environment } from './environment';
import { isDevelopment } from './is-development';

describe('isDevelopment', () => {
	it('is exported by the @gauzy/config entry point', () => {
		expect(exportedIsDevelopment).toBe(isDevelopment);
	});

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
