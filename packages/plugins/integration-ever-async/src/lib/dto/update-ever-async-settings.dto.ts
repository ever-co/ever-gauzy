import { PartialType } from '@nestjs/swagger';
import { ConfigureEverAsyncIntegrationDto } from './configure-ever-async-integration.dto';

/**
 * DTO for updating Ever Async integration settings.
 * All fields are optional (partial update). `apiToken`, when provided,
 * replaces the stored token (write-only — never returned).
 */
export class UpdateEverAsyncSettingsDto extends PartialType(ConfigureEverAsyncIntegrationDto) {}
