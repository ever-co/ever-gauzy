import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface ApprovalsPolicy extends IBaseEntityModel {
	organizationId?: string;
	tenantId?: string;
	name?: string;
	type?: number;
	description: string;
}
