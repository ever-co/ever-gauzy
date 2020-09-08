import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface EquipmentSharingPolicy extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	description?: string;
	organization?: Organization;
	tenant: ITenant;
}
