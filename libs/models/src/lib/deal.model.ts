import { BaseEntityModel, PipelineStage, User, Contact } from '@gauzy/models';


export interface Deal extends BaseEntityModel, DealCreateInput {
	createdBy: User;
	stage: PipelineStage;
	client?: Contact;
	probability?: number;
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