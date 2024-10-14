import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { ID, RequestMethod } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLog } from './api-call-log.entity';

@Injectable()
export class ApiCallLogMiddleware implements NestMiddleware {
	private readonly logger = new Logger(ApiCallLogMiddleware.name);
	private readonly loggingEnabled = true;

	constructor(private readonly apiCallLogService: ApiCallLogService) {}

	/**
	 * Middleware for logging API requests and responses to the database.
	 * This middleware generates a unique `correlationId` for each request
	 * and captures key details about the incoming request and outgoing response.
	 *
	 * @param req The incoming HTTP request object.
	 * @param res The outgoing HTTP response object.
	 * @param next The next middleware function in the request-response cycle.
	 */
	async use(req: Request, res: Response, next: NextFunction): Promise<void> {
		let responseBody = '';
		const startTime = Date.now(); // Capture request start time

		// Generate a unique correlation ID if not provided
		const correlationId = RequestContext.getContextId() ?? uuidv4();
		this.logger.debug(`Logging API call with correlation ID: ${correlationId}`);

		// Retrieve the organization ID and tenant ID from request headers
		const organizationId = (req.headers['organization-id'] as ID) || null;
		const tenantId = (req.headers['tenant-id'] as ID) || null;

		// Redact sensitive data from request headers and body
		const requestHeaders = this.redactSensitiveData(req.headers, ['authorization', 'token']);
		const requestBody = this.redactSensitiveData(req.body, ['password', 'secretKey', 'accessToken']);

		// Capture the original end method of the response object to log the response body
		const originalEnd = res.end;
		res.end = (chunk: any, encoding?: any, callback?: any) => {
			if (chunk && (typeof chunk === 'string' || chunk instanceof Buffer || chunk instanceof Uint8Array)) {
				responseBody += chunk; // Append chunk to response body
			}
			return originalEnd.call(res, chunk, encoding, callback); // Call original res.end with the arguments
		};

		// Get user ID from request context or JWT token
		let userId = RequestContext.currentUserId();

		try {
			const authHeader = req.headers['authorization']; // Get the authorization header
			const token = authHeader?.split(' ')[1]; // Extract the token from the authorization header
			// Decode the JWT token and retrieve the user ID
			if (!userId && token) {
				const jwtPayload: string | jwt.JwtPayload = jwt.decode(token);
				userId = typeof jwtPayload === 'object' ? jwtPayload['sub'] || jwtPayload['id'] : null;
			}
		} catch (error) {
			this.logger.error('Failed to decode JWT token or retrieve user ID', error.stack);
		}

		// Listen for the 'finish' event to log the API call after the response is completed
		res.on('finish', async () => {
			// Redact sensitive data from response body
			const redactedResponseBody = this.redactSensitiveData(responseBody, [
				'password',
				'secretKey',
				'accessToken'
			]);

			const entity = new ApiCallLog({
				correlationId,
				organizationId,
				tenantId,
				method: this.mapHttpMethodToEnum(req.method),
				url: req.originalUrl,
				protocol: req.protocol || null,
				ipAddress: req.ip || null,
				origin: req.headers['origin'] || null,
				userAgent: req.headers['user-agent'] || '',
				requestHeaders,
				requestBody,
				statusCode: res.statusCode,
				responseBody: redactedResponseBody || {},
				requestTime: new Date(startTime),
				responseTime: new Date(),
				userId: userId || null
			});
			this.logger.debug('ApiCallLogMiddleware: logging API call entity:', entity);

			try {
				// Asynchronously log the API call to the database
				await this.apiCallLogService.create(entity);
			} catch (error) {
				this.logger.error('Failed to log API call', error.stack);
			}
		});

		next(); // Pass control to the next middleware
	}

	/**
	 * Redacts sensitive fields like passwords and tokens from request data.
	 * This function removes or masks sensitive data from headers and body before logging.
	 *
	 * @param {any} data - The data object to clean (headers or body).
	 * @param {string[]} sensitiveFields - The list of sensitive fields to redact.
	 * @returns {any} - The cleaned data object.
	 */
	redactSensitiveData(data: any, sensitiveFields: string[] = ['password', 'Authorization', 'token']): any {
		// If data is not an object or array, return it as-is
		if (typeof data !== 'object' || data === null) {
			return data;
		}

		// If data is an array, process each element
		if (Array.isArray(data)) {
			return data.map((item) => this.redactSensitiveData(item, sensitiveFields));
		}

		// If data is an object, create a shallow copy to avoid mutating the original
		const cleanedData = { ...data };

		// Iterate through the object's keys and redact sensitive fields
		for (const key of Object.keys(cleanedData)) {
			if (sensitiveFields.includes(key)) {
				// Redact the sensitive field
				cleanedData[key] = '[REDACTED]';
			} else if (typeof cleanedData[key] === 'object' && cleanedData[key] !== null) {
				// Recursively process nested objects and arrays
				cleanedData[key] = this.redactSensitiveData(cleanedData[key], sensitiveFields);
			}
		}

		return cleanedData;
	}

	/**
	 * Maps an HTTP method string (e.g., 'GET', 'POST') to the corresponding RequestMethod enum.
	 *
	 * This function takes an HTTP method as a string and returns the matching RequestMethod enum.
	 * It handles case-insensitivity by converting the input string to uppercase.
	 * If the input does not match any valid HTTP method, it defaults to `RequestMethod.ALL`.
	 *
	 * @param method The HTTP method string to map (e.g., 'GET', 'POST').
	 * @returns The corresponding RequestMethod enum value.
	 */
	mapHttpMethodToEnum(method: string): RequestMethod {
		const methodUpper = method.toUpperCase(); // Convert the input string to uppercase

		// Return the corresponding RequestMethod enum value, or RequestMethod.ALL if not found
		return RequestMethod[methodUpper as keyof typeof RequestMethod] ?? RequestMethod.ALL;
	}
}
