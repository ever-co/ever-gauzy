import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ID, RequestMethod } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLog } from './api-call-log.entity';

@Injectable()
export class ApiCallLogMiddleware implements NestMiddleware {
	constructor(private readonly _apiCallLogService: ApiCallLogService) {}

	/**
	 * Middleware for logging API requests and responses to the database.
	 *
	 * This middleware generates a unique `correlationId` for each request and captures key details
	 * about the incoming request and the outgoing response, including:
	 *
	 * @param req The incoming HTTP request object.
	 * @param res The outgoing HTTP response object.
	 * @param next The next middleware function in the request-response cycle.
	 * @returns void
	 */
	async use(req: Request, res: Response, next: NextFunction): Promise<void> {
		let responseBody = '';

		// Generate a unique correlation ID if not provided
		const correlationId = RequestContext.getContextId() ?? uuidv4();
		console.log('ApiCallLogMiddleware: logging API call...: %s', RequestContext.getContextId());

		// Get the current user ID
		const userId = RequestContext.currentUserId();

		// Retrieve the user's organization ID and tenant ID from the request headers
		const organizationId = req.headers['organization-id'] as ID;
		const tenantId = req.headers['tenant-id'] as ID;

		// Redact sensitive data from request headers and body
		const requestHeaders = this.redactSensitiveData(req.headers, ['authorization', 'token']);
		const requestBody = this.redactSensitiveData(req.body, ['password', 'secretKey', 'accessToken']);
		const startTime = Date.now(); // Capture request start time

		console.log('ApiCallLogMiddleware: logging API call for request: %s', req.user);

		const originalEnd = res.end;

		// Override res.end to capture response body
		res.end = (chunk: any) => {
			if (chunk) {
				// If a chunk is provided, ensure it's a string, buffer, or similar valid type
				if (typeof chunk === 'string' || chunk instanceof Buffer || chunk instanceof Uint8Array) {
					responseBody += chunk; // Append to captured response body
				}
			}
			return originalEnd.apply(res, arguments); // Call original res.end with proper arguments
		};

		// Listen for the 'finish' event to capture response details
		res.on('finish', async () => {
			const entity = new ApiCallLog({
				correlationId,
				organizationId: organizationId || null,
				tenantId: tenantId || null,
				method: this.mapHttpMethodToEnum(req.method),
				url: req.originalUrl,
				protocol: req.protocol || null,
				ipAddress: req.ip || null,
				origin: req.headers['origin'] || null,
				userAgent: req.headers['user-agent'] || '',
				requestHeaders: requestHeaders || {},
				requestBody: requestBody || {},
				statusCode: res.statusCode,
				responseBody: responseBody || {},
				requestTime: new Date(startTime),
				responseTime: new Date(),
				userId: userId || null
			});
			console.log('ApiCallLogMiddleware: logging API call entity: %s', entity);

			try {
				// Asynchronously log the API call to the database
				await this._apiCallLogService.create(entity);
			} catch (error) {
				console.error('Failed to log API call:', error); // Catch any errors during logging
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
		// If the data is not an object, return it as-is
		if (typeof data !== 'object' || data === null) {
			return data;
		}

		// Create a shallow copy of the data object
		const cleanedData = { ...data };

		// Iterate through sensitive fields and remove or mask them
		for (const field of sensitiveFields) {
			if (field in cleanedData) {
				// Remove the field or mask it (e.g., replace with 'REDACTED')
				cleanedData[field] = '[REDACTED]';
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
		const methodUpper = method.toUpperCase();

		return RequestMethod[methodUpper as keyof typeof RequestMethod] ?? RequestMethod.ALL;
	}
}
