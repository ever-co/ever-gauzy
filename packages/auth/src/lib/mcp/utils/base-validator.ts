/**
 * Base Validator
 *
 * Centralized validation utilities following DRY principle
 * Provides consistent validation patterns across OAuth 2.0 components
 */

import type { AuthorizeRequest, TokenRequest } from '../server/oauth-authorization-server';

export interface ValidationResult {
	valid: boolean;
	error?: string;
	errorDescription?: string;
}

export class BaseValidator {
	/**
	 * Validate email format
	 */

	static readonly BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
	static validateEmail(email: string): ValidationResult {
		if (!email || typeof email !== 'string') {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Email is required'
			};
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid email format'
			};
		}

		return { valid: true };
	}

	/**
	 * Validate URL format
	 */
	static validateUrl(url: string): ValidationResult {
		if (!url || typeof url !== 'string') {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'URL is required'
			};
		}

		try {
			const parsed = new URL(url);
			if (!/^https?:$/.test(parsed.protocol)) {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'URL must use http(s)'
				};
			}
			if (parsed.username || parsed.password) {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'URL must not contain credentials'
				};
			}
			if (!parsed.hostname) {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'URL must include host'
				};
			}
			if (parsed.hash) {
				return {
					valid: false,
					error: 'invalid_request',
				errorDescription: 'URL must not contain fragment'
			};
		}
		return { valid: true };
		} catch {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid URL format'
			};
		}
	}

	/**
	 * Validate OAuth 2.0 scope format
	 */
	static validateScope(scope: string): ValidationResult {
		if (typeof scope !== 'string') {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid scope parameter type'
			};
		}
		if (!scope) {
			return { valid: true }; // Scope is optional
		}

		// Scope should be space-separated tokens
		// Allow URI-style scopes containing '/'
		const scopeRegex = /^[\w.\-:\/]+(\s+[\w.\-:\/]+)*$/;
		if (!scopeRegex.test(scope)) {
			return {
				valid: false,
				error: 'invalid_scope',
				errorDescription: 'Invalid scope format'
			};
		}

		return { valid: true };
	}

	/**
	 * Validate OAuth 2.0 authorize request
	 */
	static validateAuthorizeRequest(params: AuthorizeRequest): ValidationResult {
		// Required parameters
		if (!params.response_type || typeof params.response_type !== 'string') {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Missing response_type parameter'
			};
		}

		if (params.response_type !== 'code') {
			return {
				valid: false,
				error: 'unsupported_response_type',
				errorDescription: 'Only authorization code flow is supported'
			};
		}

		if (!params.client_id) {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Missing client_id parameter'
			};
		}
		const clientIdValidation = BaseValidator.validateClientCredentials(params.client_id);
		if (!clientIdValidation.valid) {
			return clientIdValidation;
		}

		if (!params.redirect_uri) {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Missing redirect_uri parameter'
			};
		}

		// Validate redirect URI format
		const redirectUriValidation = BaseValidator.validateUrl(params.redirect_uri);
		if (!redirectUriValidation.valid) {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid redirect_uri format'
			};
		}

		// Validate scope if provided
		if (params.scope) {
			const scopeValidation = BaseValidator.validateScope(params.scope);
			if (!scopeValidation.valid) {
				return scopeValidation;
			}
		}

		// Validate state if provided
		if (params.state) {
			const stateValidation = BaseValidator.validateState(params.state);
			if (!stateValidation.valid) {
				return stateValidation;
			}
		}

		// Validate PKCE parameters consistency
		if (params.code_challenge_method && !params.code_challenge) {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'code_challenge_method provided without code_challenge'
			};
		}

		// Validate PKCE parameters if provided
		if (params.code_challenge) {
			if (!params.code_challenge_method) {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'Missing code_challenge_method when code_challenge is provided'
				};
			}

			// Prefer S256; disallow plain unless explicitly supported
			if (!['S256'].includes(params.code_challenge_method)) {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'Unsupported code_challenge_method (S256 required)'
				};
			}

			// Validate code challenge format (base64url-encoded)
			const codeChallenge = params.code_challenge;
			if (typeof codeChallenge !== 'string') {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'Invalid code_challenge parameter type'
				};
			}
			if (!BaseValidator.BASE64URL_RE.test(codeChallenge) || codeChallenge.length < 43 || codeChallenge.length > 128) {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'Invalid code_challenge format'
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Validate OAuth 2.0 token request
	 */
	static validateTokenRequest(params: TokenRequest): ValidationResult {
		if (!params.grant_type || typeof params.grant_type !== 'string') {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Missing grant_type parameter'
			};
		}

		const supportedGrantTypes = ['authorization_code', 'refresh_token', 'client_credentials'];
		if (!supportedGrantTypes.includes(params.grant_type)) {
			return {
				valid: false,
				error: 'unsupported_grant_type',
				errorDescription: `Unsupported grant type: ${params.grant_type}`
			};
		}

		// client_id may be supplied via Authorization header; treat as optional here
		if (params.client_id !== undefined) {
			if (typeof params.client_id !== 'string') {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'Invalid client_id parameter type'
				};
			}
			const clientIdValidation = BaseValidator.validateClientCredentials(params.client_id);
			if (!clientIdValidation.valid) {
				return clientIdValidation;
			}
		}

		// Grant-type specific validation
		switch (params.grant_type) {
			case 'authorization_code':
				if (!params.code) {
					return {
						valid: false,
						error: 'invalid_request',
						errorDescription: 'Missing code parameter for authorization_code grant'
					};
				}
				if (typeof params.code !== 'string') {
					return {
						valid: false,
						error: 'invalid_request',
						errorDescription: 'Invalid code parameter type'
					};
				}
				if (params.redirect_uri) {
					const redirectUriValidation = BaseValidator.validateUrl(params.redirect_uri);
					if (!redirectUriValidation.valid) {
						return {
							valid: false,
							error: 'invalid_request',
							errorDescription: 'Invalid redirect_uri format'
						};
					}
				}
				if (params.code_verifier !== undefined) {
					if (typeof params.code_verifier !== 'string') {
						return {
							valid: false,
							error: 'invalid_request',
							errorDescription: 'Invalid code_verifier parameter type'
						};
					}
					if (
						!BaseValidator.BASE64URL_RE.test(params.code_verifier) ||
						params.code_verifier.length < 43 ||
						params.code_verifier.length > 128
					) {
						return {
							valid: false,
							error: 'invalid_request',
							errorDescription: 'Invalid code_verifier format'
						};
					}
				}
				break;

			case 'refresh_token':
				if (!params.refresh_token) {
					return {
						valid: false,
						error: 'invalid_request',
						errorDescription: 'Missing refresh_token parameter for refresh_token grant'
					};
				}
				if (typeof params.refresh_token !== 'string') {
					return {
						valid: false,
						error: 'invalid_request',
						errorDescription: 'Invalid refresh_token parameter type'
					};
				}
				break;

			case 'client_credentials':
				break;
		}

		// Validate scope if provided
		if (params.scope) {
			const scopeValidation = BaseValidator.validateScope(params.scope);
			if (!scopeValidation.valid) {
				return scopeValidation;
			}
		}

		return { valid: true };
	}

	/**
	 * Validate client credentials
	 */
	static validateClientCredentials(clientId: string, clientSecret?: string): ValidationResult {
		if (!clientId || typeof clientId !== 'string') {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid client_id'
			};
		}

		// Basic client ID format validation (alphanumeric with hyphens)
		const clientIdRegex = /^[a-zA-Z0-9\-_]+$/;
		if (!clientIdRegex.test(clientId) || clientId.length < 8 || clientId.length > 128) {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid client_id format'
			};
		}

		// If client secret is provided, validate it
		if (clientSecret !== undefined) {
			if (typeof clientSecret !== 'string' || clientSecret.length < 8) {
				return {
					valid: false,
					error: 'invalid_request',
					errorDescription: 'Invalid client_secret'
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Sanitize and validate state parameter
	 */
	static validateState(state?: string): ValidationResult {
		if (state === undefined) {
			return { valid: true }; // State is optional
		}

		if (typeof state !== 'string') {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid state parameter type'
			};
		}

		// State should be printable ASCII characters, max 256 chars
		const stateRegex = /^[\x20-\x7E]*$/;
		if (!stateRegex.test(state) || state.length > 256) {
			return {
				valid: false,
				error: 'invalid_request',
				errorDescription: 'Invalid state parameter format'
			};
		}

		return { valid: true };
	}
}
