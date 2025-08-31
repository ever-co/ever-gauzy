import { IEnvironment } from './ienvironment';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

const logger = new Logger('Environment');

// __dirname is available in CommonJS by default

// Load environment variables from multiple possible locations
const envPaths = [
	// Project root .env file
	path.resolve(process.cwd(), '.env'),
	// MCP server app-specific .env file
	path.resolve(process.cwd(), 'apps/server-mcp/.env'),
	// Package root .env file (when running from nested location)
	path.resolve(__dirname, '../../../.env'),
	// Local .env file relative to environments directory
	path.resolve(__dirname, '../.env')
];

// Try to load .env file from multiple locations (silently)
envPaths.forEach((envPath) => {
		const result = dotenv.config({ path: envPath });
		// Only log in debug mode and only to stderr to avoid interfering with MCP responses
		if (!result.error && process.env.GAUZY_MCP_DEBUG === 'true') {
			logger.log(`✓ Loaded environment from: ${envPath}`);
		}
});

// Validate required environment variables
function validateEnvironment(): void {
	const errors: string[] = [];

	// URL validation helper function
	const isValidUrl = (urlString: string): boolean => {
		try {
			new URL(urlString);
			return true;
		} catch {
			return false;
		}
	};

	// Email validation using regex
	const isValidEmail = (email: string): boolean => {
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		return emailRegex.test(email);
	};

	// Check for required URL variables and validate format
	if (!process.env.API_BASE_URL && !process.env.GAUZY_API_BASE_URL) {
		errors.push('API_BASE_URL or GAUZY_API_BASE_URL is required');
	} else {
		// Validate URL format if present
		if (process.env.API_BASE_URL && !isValidUrl(process.env.API_BASE_URL)) {
			errors.push('API_BASE_URL must be a valid URL format');
		}
		if (process.env.GAUZY_API_BASE_URL && !isValidUrl(process.env.GAUZY_API_BASE_URL)) {
			errors.push('GAUZY_API_BASE_URL must be a valid URL format');
		}
	}

	// Check for authentication credentials
	if (process.env.GAUZY_AUTO_LOGIN === 'true') {
		if (!process.env.GAUZY_AUTH_EMAIL) {
			errors.push('GAUZY_AUTH_EMAIL is required when GAUZY_AUTO_LOGIN is enabled');
		} else if (!isValidEmail(process.env.GAUZY_AUTH_EMAIL)) {
			errors.push('GAUZY_AUTH_EMAIL must be a valid email address format');
		}

		if (!process.env.GAUZY_AUTH_PASSWORD) {
			errors.push('GAUZY_AUTH_PASSWORD is required when GAUZY_AUTO_LOGIN is enabled');
		}
	}

	if (errors.length > 0) {
		logger.error('❌ Environment Configuration Errors:');
		errors.forEach((error) => logger.error(`   ${error}`));
		logger.error('\nPlease create a .env file in apps/server-mcp/ with the required variables.');
		logger.error('Example:');
		logger.error('API_BASE_URL=http://localhost:3000');
		logger.error('GAUZY_AUTO_LOGIN=true');
		logger.error('GAUZY_AUTH_EMAIL=your-email@example.com');
		logger.error('GAUZY_AUTH_PASSWORD=***');
		throw new Error('Invalid environment configuration – see logs above.');
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
			logger.warn('⚠️  Invalid API_TIMEOUT, using default 30000ms');
		}
		return 30000;
	}
	return timeout;
}

export const environment: IEnvironment = {
	production: process.env.NODE_ENV === 'production',
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
