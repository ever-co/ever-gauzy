export enum GenericEmployeeTypes {
	INTERN = 'Intern',
	CONTRACT = 'Contract',
	PROBATION = 'Probation',
	PART_TIME = 'Part-time',
	FULL_TIME = 'Full-time'
}

export interface EmployeeType {
	id?: number;
	name: string;
	organizationId: string;
}
