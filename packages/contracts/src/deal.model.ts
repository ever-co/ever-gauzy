import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';
import { IPipelineStage } from './pipeline-stage.model';
import { IContact } from './contact.model';

export interface IDeal extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	probability?: number;
	createdBy: IUser;
	createdByUserId: ID;
	stage: IPipelineStage;
	stageId: ID;
	client?: IContact;
	clientId?: ID;
}

export type IDealFindInput = Partial<IDealCreateInput>;

export interface IDealCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	createdByUserId: ID;
	stageId: ID;
	clientId?: ID;
	title: string;
	probability?: number;
}
