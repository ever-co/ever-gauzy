import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadEnv } from './load-env';

async function bootstrap() {
	loadEnv();
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
