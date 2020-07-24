import { BaseEntityModel, PipelineStage, User } from '@gauzy/models';

export interface Deal extends BaseEntityModel, DealCreateInput {
	createdBy: User;

	stage: PipelineStage;
}

export type DealFindInput = Partial<DealCreateInput>;

export interface DealCreateInput {
	createdByUserId: string;

	stageId: string;

	title: string;
}
