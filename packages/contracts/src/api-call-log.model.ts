import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IRelationalUser } from './user.model';

/**
 * Enum representing the HTTP method used in the request.
 */
export enum RequestMethod {
	GET = 0,
	POST = 1,
	PUT = 2,
	DELETE = 3,
	PATCH = 4,
	ALL = 5,
	OPTIONS = 6,
	HEAD = 7,
	SEARCH = 8
}

/**
 * Interface representing an API call log entry.
 */
export interface IApiCallLog extends IBasePerTenantAndOrganizationEntityModel, IRelationalUser {
	correlationId: ID; // Correlation ID to track the request across services.
	url: string; // The request URL that was called.
	method: RequestMethod; // The HTTP method (GET, POST, etc.) used in the request.
	statusCode: number; // The HTTP status code returned from the request.
	requestHeaders: JsonData; // Request headers stored as JSON string.
	requestBody: JsonData; // Request body stored as JSON string.
	responseBody: JsonData; // Response body stored as JSON string.
	requestTime: Date; // The timestamp when the request was initiated.
	responseTime: Date; // The timestamp when the response was completed.
	ipAddress: string; // The IP address of the client making the request.
	protocol: string; // The protocol used in the request (HTTP, HTTPS).
	userAgent: string; // User-Agent string of the client making the request (could be a browser, desktop app, Postman, etc.).
	origin: string; // Origin from where the request was initiated (web, mobile, desktop, etc.).
}
