
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
