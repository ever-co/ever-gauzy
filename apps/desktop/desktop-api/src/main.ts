/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.enableCors();
	const globalPrefix = 'api';
	app.setGlobalPrefix(globalPrefix);
	const port = 3232;
	await app.listen(port, () => {
		Logger.log(
			'Listening at http://localhost:' + port + '/' + globalPrefix
		);
	});
}

bootstrap();
