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
export const setupSwagger = async (
	app: INestApplication,
	{
		title = 'Gauzy API',
		description = 'Gauzy API Documentation',
		version = '1.0',
		swaggerPath = 'docs',
		scalarPath = 'scalar',
		enableScalar = true
	}: {
		title?: string;
		description?: string;
		version?: string;
		swaggerPath?: string;
		scalarPath?: string;
		enableScalar?: boolean;
	} = {}
): Promise<string> => {
	// Build Swagger configuration
	const config = new DocumentBuilder()
		.setTitle(title)
		.setDescription(description)
		.setVersion(version)
		.addBearerAuth()
		.build();
	// Swagger document options (if needed, can add additional options here)
	const options: SwaggerDocumentOptions = {
		operationIdFactory: (controllerKey: string, methodKey: string) => methodKey
	};

	// Generate the Swagger document from the app instance and configuration
	const document = SwaggerModule.createDocument(app, config, options);

	// Custom options for the Swagger UI (e.g., custom CSS, custom site title, etc.)
	const customOptions: SwaggerCustomOptions = {
		swaggerOptions: {
			persistAuthorization: true,
			docExpansion: 'none',
			filter: true,
			showRequestDuration: true
		},
		customSiteTitle: title
	};

	// Setup Swagger UI at the `/docs` endpoint
	SwaggerModule.setup(swaggerPath, app, document, customOptions);

	// Setup Scalar UI if enabled
	if (enableScalar) {
		await setupScalarUI(app, document, scalarPath, swaggerPath, title);
	}

	return swaggerPath;
};

/**
 * Sets up Scalar UI documentation
 * @private
 */
async function setupScalarUI(
	app: INestApplication,
	document: any,
	scalarPath: string,
	swaggerPath: string,
	title: string
): Promise<void> {
	try {
		// Try to dynamically import @scalar/nestjs-api-reference
		const { apiReference } = await eval("import('@scalar/nestjs-api-reference')");

		app.use(
			`/${scalarPath}`,
			apiReference({
				theme: 'default',
				layout: 'modern',
				spec: {
					content: document
				}
			})
		);
	} catch (error) {
		console.warn('Failed to load @scalar/nestjs-api-reference, using CDN fallback:', error);

		// Fallback to CDN approach
		const httpAdapter = app.getHttpAdapter();
		httpAdapter.get(`/${scalarPath}`, (_req, res) => {
			const html = `
<!doctype html>
<html>
  <head>
    <title>${title} - Scalar Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/${swaggerPath}-json"
      data-configuration='${JSON.stringify({
			theme: 'default',
			layout: 'modern'
		})}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
			res.type('text/html').send(html);
		});
	}
}
