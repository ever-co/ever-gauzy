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
		swaggerPath = 'swg',
		scalarPath = 'docs',
		enableScalar = true,
		contact = {
			name: 'Ever Co. LTD',
			url: 'https://ever.co',
			email: 'support@ever.co'
		},
		license = {
			name: 'AGPL-3.0-only',
			url: 'https://opensource.org/license/agpl-v3'
		},
		externalDocs = {
			description: 'Find more info here',
			url: 'https://docs.gauzy.co'
		},
		servers = [
			{
				url: 'http://localhost:3000',
				description: 'Development Server'
			},
			{
				url: 'https://apidemo.gauzy.co/api',
				description: 'Demo Server'
			},
			{
				url: 'https://api.gauzy.co',
				description: 'Production Server'
			}
		]
	}: {
		title?: string;
		description?: string;
		version?: string;
		swaggerPath?: string;
		scalarPath?: string;
		enableScalar?: boolean;
		contact?: {
			name?: string;
			url?: string;
			email?: string;
		};
		license?: {
			name?: string;
			url?: string;
		};
		externalDocs?: {
			description?: string;
			url?: string;
		};
		servers?: Array<{
			url: string;
			description: string;
		}>;
	} = {}
): Promise<string> => {
	// Swagger configuration
	const config = new DocumentBuilder()
		.setTitle(title)
		.setDescription(description)
		.setVersion(version)
		.setContact(contact.name, contact.url, contact.email)
		.setLicense(license.name, license.url)
		.setExternalDoc(externalDocs.description, externalDocs.url)
		.addBearerAuth({
			type: 'http',
			scheme: 'bearer',
			bearerFormat: 'JWT',
			name: 'JWT',
			description: 'Enter JWT token',
			in: 'header'
		})
		.addApiKey(
			{
				type: 'apiKey',
				name: 'X-API-Key',
				in: 'header',
				description: 'API Key for authentication'
			},
			'api-key'
		)
		.addOAuth2({
			type: 'oauth2',
			flows: {
				authorizationCode: {
					authorizationUrl: '/oauth/authorize',
					tokenUrl: '/oauth/token',
					scopes: {
						read: 'Read access',
						write: 'Write access',
						admin: 'Admin access'
					}
				}
			}
		})
		.build();

	// Add servers to the document
	if (servers && servers.length > 0) {
		config.servers = servers;
	}
	// Swagger document options (if needed, can add additional options here)
	const options: SwaggerDocumentOptions = {
		operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey
	};

	// Generate the Swagger document from the app instance and configuration
	const document = SwaggerModule.createDocument(app, config, options);

	// Custom options for the Swagger UI
	const customOptions: SwaggerCustomOptions = {
		swaggerOptions: {
			persistAuthorization: true,
			docExpansion: 'none',
			filter: true,
			showRequestDuration: true
		},
		customSiteTitle: title
	};

	// Setup Swagger UI at the `/swg` endpoint
	SwaggerModule.setup(swaggerPath, app, document, customOptions);

	// Setup Scalar UI if enabled
	if (enableScalar) {
		await setupScalarUI(app, document, scalarPath, swaggerPath, title, servers);
	}

	return swaggerPath;
};

/**
 * Sets up Scalar UI documentation with enhanced configuration
 * @private
 */
async function setupScalarUI(
	app: INestApplication,
	document: any,
	scalarPath: string,
	swaggerPath: string,
	title: string,
	servers: Array<{ url: string; description: string }>
): Promise<void> {
	// Scalar configuration
	const scalarConfig = {
		theme: 'default',
		layout: 'modern',
		content: document,
		metaData: {
			title: `${title} - API Documentation`,
			description: `API documentation for ${title}`
		},
		showSidebar: true,
		showToolbar: true,
		persistAuth: true,
		servers: servers
	};

	try {
		// Try to dynamically import @scalar/nestjs-api-reference
		const { apiReference } = await eval("import('@scalar/nestjs-api-reference')");

		app.use(`/${scalarPath}`, apiReference(scalarConfig));
	} catch (error) {
		console.warn('Failed to load @scalar/nestjs-api-reference, using CDN fallback:', error);

		// CDN fallback
		const httpAdapter = app.getHttpAdapter();
		httpAdapter.get(`/${scalarPath}`, (_req, res) => {
			const html = `
<!doctype html>
<html>
  <head>
    <title>${scalarConfig.metaData.title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${scalarConfig.metaData.description}" />

  </head>
  <body>
    <script
      id="api-reference"
      data-url="/${swaggerPath}-json"
      data-configuration='${JSON.stringify({
			theme: scalarConfig.theme,
			layout: scalarConfig.layout,
			metaData: scalarConfig.metaData,
			showSidebar: scalarConfig.showSidebar,
			showToolbar: scalarConfig.showToolbar,
			persistAuth: scalarConfig.persistAuth,
			servers: scalarConfig.servers
		})}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
			res.type('text/html').send(html);
		});
	}
}
