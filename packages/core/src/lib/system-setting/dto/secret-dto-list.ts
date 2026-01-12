import {
	SentryConfigDTO,
	UnleashConfigDTO,
	GoogleMapsConfigDTO,
	PosthogConfigDTO,
	JitsuConfigDTO,
	GauzyAIConfigDTO,
	CloudinaryConfigDTO,
	ChatwootConfigDTO
} from './index';

/**
 * Module-level constant for secret DTOs to avoid recreating on each call.
 * Used by WrapSecrets decorator to mask sensitive data in system settings responses.
 */
export const SECRET_DTO_LIST = [
	new SentryConfigDTO(),
	new UnleashConfigDTO(),
	new GoogleMapsConfigDTO(),
	new PosthogConfigDTO(),
	new JitsuConfigDTO(),
	new GauzyAIConfigDTO(),
	new CloudinaryConfigDTO(),
	new ChatwootConfigDTO()
];
