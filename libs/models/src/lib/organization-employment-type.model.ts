import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export enum GenericEmploymentTypes {
	INTERN = 'Intern',
	CONTRACT = 'Contract',
	PROBATION = 'Probation',
	PART_TIME = 'Part-time',
	FULL_TIME = 'Full-time',
	CONTRACTOR = 'Contractor'
}

export interface OrganizationEmploymentType extends IBaseEntityModel {
	name: string;
	organizationId: string;
}

export interface OrganizationEmploymentTypeFindInput {
	organizationId?: string;
}

export interface OrganizationEmploymentTypeCreateInput {
	name: string;
	organizationId: string;
}
