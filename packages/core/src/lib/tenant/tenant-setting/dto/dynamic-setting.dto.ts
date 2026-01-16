import { ITenantSetting } from '@gauzy/contracts';

/**
 * Generic DTO for dynamic tenant/global settings.
 * Accepts any key-value pairs for flexible settings storage.
 */
export class DynamicSettingDTO implements ITenantSetting {
	[key: string]: any;
}
