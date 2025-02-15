import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, SwaggerDocumentOptions, SwaggerCustomOptions } from '@nestjs/swagger';

/**
 * Sets up and configures Swagger API documentation for the given NestJS application.
 *
 * This function creates a Swagger configuration using the DocumentBuilder by setting the title,
 * description, version, and enabling bearer authentication. It then generates the Swagger document
 * with any additional options and sets up the Swagger UI at the specified endpoint.
 *
 * @param {INestApplication} app - The NestJS application instance.
 * @returns {Promise<string>} A promise that resolves to the Swagger documentation path.
 */
export const setupSwagger = async (app: INestApplication): Promise<string> => {
	const config = new DocumentBuilder()
		.setTitle('Gauzy API')
		.setDescription('Gauzy API Documentation')
		.setVersion('1.0')
		.addBearerAuth()
		.build();

	// Swagger document options (if needed, can add additional options here)
	const options: SwaggerDocumentOptions = {};

	// Generate the Swagger document from the app instance and configuration
	const document = SwaggerModule.createDocument(app, config, options);

	// Custom options for the Swagger UI (e.g., custom CSS, custom site title, etc.)
	const customOptions: SwaggerCustomOptions = {};

	// Define the Swagger endpoint path
	const swaggerPath = 'docs';

	// Setup Swagger UI at the `/docs` endpoint
	SwaggerModule.setup(swaggerPath, app, document, customOptions);

	// Return the Swagger path
	return swaggerPath;
};
