import { IEnvironment } from './ienvironment.js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the directory name in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from multiple possible locations
const envPaths = [
	path.resolve(process.cwd(), '.env'),
	path.resolve(process.cwd(), 'apps/server-mcp/.env'),
	path.resolve(__dirname, '../../../.env'),
	path.resolve(__dirname, '../.env')
];

// Try to load .env file from multiple locations (silently)
envPaths.forEach((envPath) => {
		const result = dotenv.config({ path: envPath });
		// Only log in debug mode and only to stderr to avoid interfering with MCP responses
		if (!result.error && process.env.GAUZY_MCP_DEBUG === 'true') {
			console.error(`✓ Loaded environment from: ${envPath}`);
		}
});

// Validate required environment variables
function validateEnvironment(): void {
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
		console.error('❌ Environment Configuration Errors:');
		errors.forEach((error) => console.error(`   ${error}`));
		console.error('\nPlease create a .env file in apps/server-mcp/ with the required variables.');
		console.error('Example:');
		console.error('API_BASE_URL=http://localhost:3000');
		console.error('GAUZY_AUTO_LOGIN=true');
		console.error('GAUZY_AUTH_EMAIL=your-email@example.com');
		console.error('GAUZY_AUTH_PASSWORD=***');
		process.exit(1);
	}
}

// Validate environment on load
validateEnvironment();

// Get base URL with fallbacks
function getBaseUrl(): string {
	return process.env.API_BASE_URL || process.env.GAUZY_API_BASE_URL || 'http://localhost:3000';
}

// Get timeout with validation
function getTimeout(): number {
	const timeout = Number.parseInt(process.env.API_TIMEOUT || '30000', 10);
	if (isNaN(timeout) || timeout <= 0) {
		if (process.env.GAUZY_MCP_DEBUG === 'true') {
			console.error('⚠️  Invalid API_TIMEOUT, using default 30000ms');
		}
		return 30000;
	}
	return timeout;
}

export const environment: IEnvironment = {
	production: false,
	envName: process.env.NODE_ENV || 'development',
	mcpAppName: process.env.MCP_APP_NAME || 'Gauzy MCP Server',
	appId: process.env.MCP_APP_ID || 'co.gauzy.mcp-server',
	baseUrl: getBaseUrl(),
	apiTimeout: getTimeout(),
	debug: process.env.GAUZY_MCP_DEBUG === 'true' || process.env.NODE_ENV === 'development',
	nodeEnv: process.env.NODE_ENV || 'development',
	auth: {
		email: process.env.GAUZY_AUTH_EMAIL || '',
		password: process.env.GAUZY_AUTH_PASSWORD || '',
		autoLogin: process.env.GAUZY_AUTO_LOGIN === 'true'
	}
};
