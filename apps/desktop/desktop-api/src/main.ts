import log from 'electron-log';
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
		const message =
			'Internal API listening at http://localhost:' +
			port +
			'/' +
			globalPrefix;
		Logger.log(message);
		log.info(message);
	});
}

bootstrap();
