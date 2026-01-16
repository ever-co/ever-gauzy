import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { ITenantSetting } from '@gauzy/contracts';

/**
 * Generic DTO for dynamic tenant/global settings.
 * Accepts any key-value pairs for flexible settings storage.
 * Used for monitoring settings (PostHog, Sentry) and other dynamic configurations.
 */
export class DynamicSettingDTO implements ITenantSetting {
	/**
	 * Allow any additional properties as key-value pairs
	 */
	[key: string]: any;
}

