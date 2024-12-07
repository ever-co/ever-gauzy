import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

/**
 * Bootstraps the NestJS application.
 *
 * This function initializes the application, enables CORS, sets a global prefix,
 * and starts listening on a specified port.
 */
async function bootstrap(): Promise<void> {
    // Create the application instance with custom logger settings.
    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose']
    });

    // Enable CORS with specific configuration.
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: [
            'Authorization',
            'Language',
            'Tenant-Id',
            'Organization-Id',
            'X-Requested-With',
            'X-Auth-Token',
            'X-HTTP-Method-Override',
            'Content-Type',
            'Content-Language',
            'Accept',
            'Accept-Language',
            'Observe'
        ].join(', ')
    });

    // Set a global API prefix for all routes.
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);

    // Retrieve the port from the environment configuration.
    const port = environment.DESKTOP_API_DEFAULT_PORT;
	console.log('Desktop API port: ' + port);

    // Start the application and listen on the specified port.
    await app.listen(port, () => {
        const successMessagePrefix = 'Listening at http';
        const message = `${successMessagePrefix}://localhost:${port}/${globalPrefix}`;
        Logger.log(message);
    });
}

// Start the application.
bootstrap();
