import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EventType extends IBaseEntityModel {
	title: string;
	description?: string;
	duration: number;
	durationUnit: string;
	employeeId?: string;
	organizationId: string;
	isActive: boolean;
}
