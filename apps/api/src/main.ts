// import * as csurf from 'csurf';
import * as helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SentryService } from '@ntegral/nestjs-sentry';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		logger: ['error', 'warn']
	});
	app.useLogger(app.get(SentryService));
	app.enableCors();

	// TODO: enable csurf
	// As explained on the csurf middleware page https://github.com/expressjs/csurf#csurf,
	// the csurf module requires either a session middleware or cookie-parser to be initialized first.
	// app.use(csurf());

	app.use(helmet());

	const options = new DocumentBuilder()
		.setTitle('Gauzy API')
		.setVersion('1.0')
		// .setBasePath('api/')
		.build();

	const document = SwaggerModule.createDocument(app, options);
	SwaggerModule.setup('swg', app, document);

	const globalPrefix = 'api';
	app.setGlobalPrefix(globalPrefix);
	const port = process.env.port || 3000;
	await app.listen(port, () => {
		console.log(
			'Listening at http://localhost:' + port + '/' + globalPrefix
		);
	});
}

bootstrap();
