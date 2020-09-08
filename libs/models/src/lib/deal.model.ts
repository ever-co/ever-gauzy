import { BaseEntityModel, PipelineStage, User, Contact, Organization, ITenant } from '@gauzy/models';

export interface Deal extends BaseEntityModel, DealCreateInput {
	createdBy: User;
	stage: PipelineStage;
	client?: Contact;
	probability?: number;
	organization?: Organization;
	tenant: ITenant;
}

export type DealFindInput = Partial<DealCreateInput>;

export interface DealCreateInput {
	createdByUserId: string;
	stageId: string;
	clientId?: string;
	organizationId: string;
	title: string;
	probability?: number;
}
