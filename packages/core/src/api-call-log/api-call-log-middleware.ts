import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';
import { ID, RequestMethod } from '@gauzy/contracts';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLog } from './api-call-log.entity';
import { RequestContext } from '../core/context';

@Injectable()
export class ApiCallLogMiddleware implements NestMiddleware {
	constructor(private readonly _apiCallLogService: ApiCallLogService, private readonly cls: ClsService) {}

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
		// Generate a unique correlation ID if not provided
		const correlationId = RequestContext.getContextId() ?? uuidv4();
		console.log('ApiCallLogMiddleware: logging API call...: %s', correlationId, RequestContext.getContextId());

		const organizationId = req.headers['x-organization-id'] as ID;
		const tenantId = req.headers['x-tenant-id'] as ID;
		console.log('ApiCallLogMiddleware: logging API call for organizationId: %s', organizationId);
		console.log('ApiCallLogMiddleware: logging API call for tenantId: %s', tenantId);

		// Redact sensitive data from request headers and body
		const requestHeaders = this.redactSensitiveData(req.headers, ['Authorization', 'token']);
		const requestBody = this.redactSensitiveData(req.body, ['password', 'secretKey', 'accessToken']);
		const startTime = Date.now(); // Capture request start time

		// Listen for the 'finish' event to capture response details
		res.on('finish', async () => {
			const entity = new ApiCallLog({
				correlationId,
				organizationId,
				tenantId,
				url: req.originalUrl,
				method: this.mapHttpMethodToEnum(req.method),
				protocol: req.protocol,
				requestHeaders,
				requestBody,
				statusCode: res.statusCode,
				responseBody: res.locals.data || {},
				requestTime: new Date(startTime), // Capture request time
				responseTime: new Date() // Capture response time
			});

			try {
				// Asynchronously log the API call to the database
				await this._apiCallLogService.create(entity).catch((error) => {
					console.error('Failed to log API call:', error); // Log error if logging fails
				});
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
