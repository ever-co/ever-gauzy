import { BaseEntityModel, Stage, User } from '@gauzy/models';

export interface Deal extends BaseEntityModel, DealCreateInput {
	createdBy: User;

	stage: Stage;
}

export type DealFindInput = Partial<DealCreateInput>;

export interface DealCreateInput {
	createdByUserId: string;

	stageId: string;

	title: string;
}
