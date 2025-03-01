import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IPipelineStage } from './pipeline-stage.model';
import { IOrganizationContact } from './organization-contact.model';

// Common base interface for deal fields
interface IDealBase extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	probability: number;
	stage: IPipelineStage;
	stageId: ID;
	client?: IOrganizationContact;
	clientId?: ID;
}

// IDeal interface with the additional stage and user creator properties
export interface IDeal extends IDealBase {}

// IDealCreateInput interface, omitting user-related fields from IDeal
export interface IDealCreateInput extends IDealBase {}

// IDealFindInput type, based on IDealCreateInput
export type IDealFindInput = Partial<IDealBase>;
