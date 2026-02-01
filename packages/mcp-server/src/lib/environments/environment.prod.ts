import { IEnvironment } from './ienvironment';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// __dirname is available in CommonJS by default

// Load environment variables from multiple possible locations
const envPaths = [
	path.resolve(process.cwd(), '.env'),
	path.resolve(process.cwd(), 'apps/server-mcp/.env'),
	path.resolve(__dirname, '../../../.env'),
	path.resolve(__dirname, '../.env')
];

// Try to load .env file from multiple locations (silently in production)
envPaths.forEach((envPath) => {
	try {
		dotenv.config({ path: envPath });
		// Only log in debug mode and only to stderr to avoid interfering with MCP responses
		if (process.env.GAUZY_MCP_DEBUG === 'true') {
			console.error(`✓ Loaded environment from: ${envPath}`);
		}
	} catch (error) {
		// Silently continue if file doesn't exist
	}
});

// Validate required environment variables for production
function validateProductionEnvironment(): void {
	const errors: string[] = [];

	if (!process.env.API_BASE_URL && !process.env.GAUZY_API_BASE_URL) {
		errors.push('API_BASE_URL or GAUZY_API_BASE_URL is required');
	}

	// Check for authentication credentials
	if (process.env.GAUZY_AUTO_LOGIN === 'true') {
		if (!process.env.GAUZY_AUTH_EMAIL) {
			errors.push('GAUZY_AUTH_EMAIL is required when GAUZY_AUTO_LOGIN is enabled');
		}
		if (!process.env.GAUZY_AUTH_PASSWORD) {
			errors.push('GAUZY_AUTH_PASSWORD is required when GAUZY_AUTO_LOGIN is enabled');
		}
	}

	if (errors.length > 0) {
		console.error('❌ Production Environment Configuration Errors:');
		errors.forEach((error) => console.error(`   ${error}`));
		console.error('\nPlease ensure all required environment variables are set in production.');
		console.error('Note: Sensitive values like passwords should be configured via environment variables.');
		process.exit(1); // Exit in production if configuration is invalid
	}
}

// Validate environment on load
validateProductionEnvironment();

// Get base URL with fallbacks
function getBaseUrl(): string {
	return process.env.API_BASE_URL || process.env.GAUZY_API_BASE_URL || '';
}

// Get timeout with validation
function getTimeout(): number {
	const timeout = Number.parseInt(process.env.API_TIMEOUT || '60000', 10); // Higher timeout for production
	if (isNaN(timeout) || timeout <= 0) {
		return 60000;
	}
	return timeout;
}

export const environment: IEnvironment = {
	production: true,
	envName: 'production',
	mcpAppName: process.env.MCP_APP_NAME || 'Gauzy MCP Server',
	appId: process.env.MCP_APP_ID || 'co.gauzy.mcp-server',
	baseUrl: getBaseUrl(),
	apiTimeout: getTimeout(),
	debug: process.env.GAUZY_MCP_DEBUG === 'true',
	nodeEnv: 'production',
	auth: {
		email: process.env.GAUZY_AUTH_EMAIL || '',
		password: process.env.GAUZY_AUTH_PASSWORD || '',
		autoLogin: process.env.GAUZY_AUTO_LOGIN === 'true'
	}
};
