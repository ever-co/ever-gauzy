/**
 * Base Error Handler
 * 
 * Centralized error handling utility following DRY and KISS principles
 * Provides consistent error formatting and logging across the MCP server
 */

import { Response } from 'express';
import { SecurityLogger } from './security-logger';
import { AuthorizationError } from './authorization-config';

export interface StandardError {
	code: string;
	message: string;
	details?: unknown;
	statusCode: number;
}

export class BaseErrorHandler {
	private securityLogger: SecurityLogger;

	constructor() {
		this.securityLogger = new SecurityLogger();
	}

	/**
	 * Handle OAuth 2.0 errors with consistent formatting
	 */
	handleOAuthError(
		res: Response,
		error: AuthorizationError,
		statusCode: number = 400
	): void {
		res.status(statusCode).json({
			error: error.error,
			error_description: error.errorDescription,
			...(error.errorUri && { error_uri: error.errorUri }),
			...(error.scope && { scope: error.scope }),
		});
	}

	/**
	 * Handle OAuth redirect errors (for authorization endpoint)
	 */
	handleOAuthRedirectError(
		res: Response,
		redirectUri: string,
		error: string,
		description?: string,
		state?: string,
		clientId?: string
	): void {
		try {
			const url = new URL(redirectUri);
			url.searchParams.set('error', error);
			if (description) url.searchParams.set('error_description', description);
			if (state) url.searchParams.set('state', state);

			this.securityLogger.warn('OAuth redirect error', {
				error,
				description,
				clientId,
				redirectUri: redirectUri.split('?')[0] // Log without query params
			});

			res.redirect(url.toString());
		} catch (urlError) {
			this.securityLogger.error('Invalid redirect URI in error handling', {
				error: urlError,
				redirectUri,
				clientId
			});
			this.handleStandardError(res, {
				code: 'invalid_redirect_uri',
				message: 'Invalid redirect URI provided',
				statusCode: 400
			});
		}
	}

	/**
	 * Handle standard HTTP errors
	 */
	handleStandardError(res: Response, error: StandardError): void {
		this.securityLogger.error('Standard error occurred', {
			code: error.code,
			message: error.message,
			statusCode: error.statusCode
		});

		res.status(error.statusCode).json({
			error: error.code,
			message: error.message,
			...(error.details && { details: error.details }),
		});
	}

	/**
	 * Handle validation errors
	 */
	handleValidationError(
		res: Response,
		field: string,
		message: string,
		statusCode: number = 400
	): void {
		this.handleStandardError(res, {
			code: 'validation_error',
			message: `${field}: ${message}`,
			statusCode,
		});
	}

	/**
	 * Handle authentication errors with proper WWW-Authenticate header
	 */
	handleAuthError(
		res: Response,
		error: AuthorizationError,
		resourceMetadataUrl?: string
	): void {
		if (resourceMetadataUrl) {
			const wwwAuthenticate = this.formatWWWAuthenticateHeader(resourceMetadataUrl, error);
			res.setHeader('WWW-Authenticate', wwwAuthenticate);
		}

		res.status(401).json({
			error: error.error,
			error_description: error.errorDescription,
			...(error.scope && { scope: error.scope }),
		});
	}

	/**
	 * Format WWW-Authenticate header according to RFC 9728
	 */
	private formatWWWAuthenticateHeader(resourceMetadataUrl: string, error?: AuthorizationError): string {
		const escapeValue = (value: string) => value.replace(/["\\\r\n]/g, '\\$&');
		let header = `Bearer resource_metadata="${escapeValue(resourceMetadataUrl)}"`;

		if (error) {
			header += `, error="${escapeValue(error.error)}"`;
			if (error.errorDescription) {
				header += `, error_description="${escapeValue(error.errorDescription)}"`;
			}
			if (error.errorUri) {
				header += `, error_uri="${escapeValue(error.errorUri)}"`;
			}
			if (error.scope) {
				header += `, scope="${escapeValue(error.scope)}"`;
			}
		}

		return header;
	}

	/**
	 * Create standard authorization error objects
	 */
	static createAuthError(
		error: AuthorizationError['error'],
		description?: string,
		scope?: string,
		errorUri?: string
	): AuthorizationError {
		return {
			error,
			errorDescription: description,
			scope,
			errorUri,
		};
	}
}