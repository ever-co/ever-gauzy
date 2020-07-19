// import * as csurf from 'csurf';
import * as helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SentryService } from '@ntegral/nestjs-sentry';
import * as expressSession from 'express-session';
import { environment as env } from '@env-api/environment';

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

	app.use(
		expressSession({
			secret: env.EXPRESS_SESSION_SECRET,
			resave: true,
			saveUninitialized: true
		})
	);

	app.use(helmet());
	const globalPrefix = 'api';
	app.setGlobalPrefix(globalPrefix);

	const options = new DocumentBuilder()
		.setTitle('Gauzy API')
		.setVersion('1.0')
		.addBearerAuth()
		// .setBasePath('api/')
		.build();

	const document = SwaggerModule.createDocument(app, options);
	SwaggerModule.setup('swg', app, document);
	const port = process.env.port || 3000;
	await app.listen(port, () => {
		console.log(
			'Listening at http://localhost:' + port + '/' + globalPrefix
		);
	});
}

bootstrap();
