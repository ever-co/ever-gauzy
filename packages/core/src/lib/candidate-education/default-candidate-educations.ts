import { ICandidateEducation } from '@gauzy/contracts';

export const DEFAULT_CANDIDATE_EDUCATIONS: ICandidateEducation[] = [
	{
		schoolName: 'MIT',
		degree: 'Master',
		completionDate: new Date(2017, 4, 4),
		field: 'Computer Science'
	}
];
