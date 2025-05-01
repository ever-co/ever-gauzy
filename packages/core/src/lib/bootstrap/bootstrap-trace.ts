import { INestApplication, Logger } from '@nestjs/common';

const logger = new Logger('ModuleInit');

/**
 * Instruments all providers that implement `onModuleInit` in a NestJS application
 * to log how long each provider takes to initialize.
 *
 * This is useful for profiling large applications with many modules to detect slow
 * startup bottlenecks during application bootstrap.
 *
 * ⚠️ This should be used only in development or diagnostics environments.
 *
 * @param app - The NestJS application instance (`INestApplication`)
 * @returns void
 */
export function traceModuleInit(app: INestApplication): void {
	const container = (app as any).container;
	const modules = container.getModules?.();

	if (!modules) {
		logger.warn('Could not access internal NestJS modules map.');
		return;
	}

	for (const [name, moduleRef] of modules.entries()) {
		const providersMap = moduleRef.providers;

		for (const [providerToken, provider] of providersMap) {
			if (!provider || typeof provider.instance !== 'object') continue;

			const instance = provider.instance;

			if (typeof instance?.onModuleInit === 'function') {
				const original = instance.onModuleInit.bind(instance);

				instance.onModuleInit = async function (...args: any[]) {
					const start = performance.now();
					try {
						await original(...args);
					} catch (error) {
						const end = performance.now();
						logger.error(`${providerToken.toString()} in ${name} failed to initialize after ${(end - start).toFixed(2)}ms`, error);
						throw error;
					}
					const end = performance.now();
					logger.log(`${providerToken.toString()} in ${name} initialized in ${(end - start).toFixed(2)}ms`);
				};
			}
		}
	}
}
