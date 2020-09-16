import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IUser } from './user.model';
import { IPipelineStage } from './pipeline-stage.model';
import { IContact } from './contact.model';

export interface IDeal extends IBasePerTenantAndOrganizationEntityModel {
	createdByUserId: string;
	stageId: string;
	clientId?: string;
	title: string;
	probability?: number;
	createdBy: IUser;
	stage: IPipelineStage;
	client?: IContact;
}

export type IDealFindInput = Partial<IDealCreateInput>;

export interface IDealCreateInput {
	createdByUserId: string;
	stageId: string;
	clientId?: string;
	organizationId: string;
	title: string;
	probability?: number;
}
