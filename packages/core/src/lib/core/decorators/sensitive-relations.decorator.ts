import { SetMetadata } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';

export const SENSITIVE_RELATIONS_KEY = 'SENSITIVE_RELATIONS_CONFIG';
export const SENSITIVE_RELATIONS_ROOT_KEY = 'SENSITIVE_RELATIONS_ROOT_KEY';

export interface SensitiveRelationConfig {
	[relation: string]: PermissionsEnum | SensitiveRelationConfig | null;
}

export const SensitiveRelations = (config: SensitiveRelationConfig, rootKey?: string) => {
	const decorators = [SetMetadata(SENSITIVE_RELATIONS_KEY, config)];
	if (rootKey) {
		decorators.push(SetMetadata(SENSITIVE_RELATIONS_ROOT_KEY, rootKey));
	}
	return (target: any, key?: any, descriptor?: any) => {
		decorators.forEach((decorator) => decorator(target, key, descriptor));
	};
};
