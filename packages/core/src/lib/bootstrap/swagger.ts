import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, SwaggerDocumentOptions, SwaggerCustomOptions } from '@nestjs/swagger';

/**
 * Sets up and configures Swagger and Scalar API documentation for the given NestJS application.
 *
 * This function creates a Swagger configuration using the DocumentBuilder by setting the title,
 * description, version, and enabling bearer authentication. It then generates the Swagger document
 * with any additional options and sets up both Swagger UI and Scalar UI at their respective endpoints.
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

	// Setup Scalar UI at `/scalar` using dynamic import for ESM compatibility
	try {
		const { apiReference } = await import('@scalar/nestjs-api-reference');

		app.use(
			'/scalar',
			apiReference({
				theme: 'default',
				layout: 'modern',
				content: document
			})
		);
	} catch (error) {
		// Fallback to CDN approach
		const httpAdapter = app.getHttpAdapter();
		httpAdapter.get('/scalar', (_req, res) => {
			const html = `
<!doctype html>
<html>
  <head>
    <title>Gauzy API - Scalar Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/docs-json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.0.3"></script>
  </body>
</html>`;
			res.type('text/html').send(html);
		});
	}

	// Return the Swagger path
	return swaggerPath;
};
