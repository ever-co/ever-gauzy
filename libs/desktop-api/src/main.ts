import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	app.enableCors();

	const globalPrefix = 'api';

	app.setGlobalPrefix(globalPrefix);

	const port = environment.DESKTOP_API_DEFAULT_PORT;

	await app.listen(port, () => {
		const message =
			'Internal API listening at http://localhost:' +
			port +
			'/' +
			globalPrefix;
		Logger.log(message);
	});
}

bootstrap();
