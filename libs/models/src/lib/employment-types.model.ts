export enum GenericEmploymentTypes {
	INTERN = 'Intern',
	CONTRACT = 'Contract',
	PROBATION = 'Probation',
	PART_TIME = 'Part-time',
	FULL_TIME = 'Full-time'
}

export interface EmploymentType {
	id?: number;
	name: string;
	organizationId: string;
}
