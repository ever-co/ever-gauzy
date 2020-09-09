import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface EquipmentSharingPolicy extends IBaseEntityModel {
	name?: string;
	description?: string;
	organization?: Organization;
	organizationId?: string;
  tenantId?: string;
	tenant?: ITenant;
}
