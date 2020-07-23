import { IEducation, Candidate } from '@gauzy/models';
import { Connection } from 'typeorm';
import { CandidateEducation } from './candidate-education.entity';
import { Tenant } from '../tenant/tenant.entity';

const candidateEducations: IEducation[] = [
	{
		schoolName: 'MIT',
		degree: 'Master',
		completionDate: new Date(2017, 4, 4),
		field: 'Computer Science'
	}
];

export const createCandidateEducations = async (
	connection: Connection,
	candidates: Candidate[] | void
): Promise<CandidateEducation[]> => {
	let defaultCandidateEducation = [];

	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateEducation will not be created'
		);
		return;
	}
	candidates.forEach((candidate) => {
		const educations = candidateEducations.map((education) => ({
			schoolName: education.schoolName,
			degree: education.degree,
			completionDate: education.completionDate,
			field: education.field,
			candidateId: candidate.id
		}));
		defaultCandidateEducation = [
			...defaultCandidateEducation,
			...educations
		];
	});
	insertCandidateEducations(connection, defaultCandidateEducation);

	return defaultCandidateEducation;
};

export const createRandomCandidateEducations = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<Map<Candidate, CandidateEducation[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateEducation will not be created'
		);
		return;
	}

	let candidateEducation = [];
	const candidateEducationsMap: Map<Candidate, any[]> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const educations = candidateEducations.map((education) => ({
				schoolName: education.schoolName,
				degree: education.degree,
				completionDate: education.completionDate,
				field: education.field,
				candidateId: candidate.id
			}));

			candidateEducationsMap.set(candidate, educations);
			candidateEducation = [...candidateEducations, ...educations];
		});
	});

	await insertCandidateEducations(connection, candidateEducation);

	return candidateEducationsMap;
};

const insertCandidateEducations = async (
	connection: Connection,
	educations: CandidateEducation[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateEducation)
		.values(educations)
		.execute();
};
