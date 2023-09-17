
// IApiKeyMethod represents an interface for ApiKey authentication method, with optional ApiKey and ApiSecret properties.
export interface IApiKeyMethod {
    ApiKey?: string;
    ApiSecret?: string;
}

export interface IBearerTokenMethod {
    ApiTenantId?: string;
    ApiBearerToken?: string;
}

export type IConfigurationOptions = IApiKeyMethod & IBearerTokenMethod;

/**
 * Represents common HTTP methods as string values.
 */
export enum HttpMethodEnum {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH',
    HEAD = 'HEAD',
    OPTIONS = 'OPTIONS',
}

/**
 * Represents HTTP request headers as an object where keys are header names and values are header values.
 */
export interface AxiosRequestHeaders {
    [key: string]: string;
}
