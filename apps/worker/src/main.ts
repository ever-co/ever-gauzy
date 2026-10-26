import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from './load-env';

async function bootstrap() {
	loadEnv();
	// libuv's 4-thread default is shared by DNS, pg SCRAM, bcrypt and fs: see apps/api/src/preload-env.ts. Set
	// before anything uses the threadpool (everything up to here is synchronous).
	if (!process.env.UV_THREADPOOL_SIZE) {
		process.env.UV_THREADPOOL_SIZE = '16';
	}
	const { registerPluginConfig } = await import('@gauzy/core');
	const { plugins } = await import('./plugins');
	await registerPluginConfig({ plugins });

	const { AppModule } = await import('./app/app.module');

	const app = await NestFactory.createApplicationContext(AppModule, {
		logger: ['log', 'error', 'warn', 'debug', 'verbose']
	});

	Logger.log('Worker application started.', 'WorkerBootstrap');

	const shutdown = async (signal: string): Promise<void> => {
		Logger.log(`Received ${signal}, closing worker...`, 'WorkerBootstrap');
		await app.close();
		process.exit(0);
	};

	process.on('SIGINT', () => {
		void shutdown('SIGINT');
	});
	process.on('SIGTERM', () => {
		void shutdown('SIGTERM');
	});
}

void bootstrap();
