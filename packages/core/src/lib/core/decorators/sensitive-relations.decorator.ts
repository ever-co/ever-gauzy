import { SetMetadata } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';

export const SENSITIVE_RELATIONS_KEY = 'SENSITIVE_RELATIONS_CONFIG';

export interface SensitiveRelationConfig {
	[relation: string]: PermissionsEnum | SensitiveRelationConfig | null;
}

export const SensitiveRelations = (config: SensitiveRelationConfig) => SetMetadata(SENSITIVE_RELATIONS_KEY, config);
