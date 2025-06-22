import { SetMetadata } from '@nestjs/common';

export const SENSITIVE_RELATIONS_KEY = 'SENSITIVE_RELATIONS_CONFIG';

export interface SensitiveRelationConfig {
	[relation: string]: string; // relation: permission
}

export const SensitiveRelations = (config: SensitiveRelationConfig) => SetMetadata(SENSITIVE_RELATIONS_KEY, config);
