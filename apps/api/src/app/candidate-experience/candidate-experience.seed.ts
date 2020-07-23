import { IExperience, Candidate } from '@gauzy/models';
import { Connection, createQueryBuilder } from 'typeorm';
import { CandidateExperience } from './candidate-experience.entity';
import { Tenant } from '../tenant/tenant.entity';

const candidateExperience: IExperience[] = [
	{
		occupation: 'Frontend Developer',
		organization: 'Ever',
		duration: '4 years'
	}
];

export const createCandidateExperiences = async (
	connection: Connection,
	candidates: Candidate[] | void
): Promise<CandidateExperience[]> => {
	let defaultCandidateExperience = [];

	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateExperience will not be created'
		);
		return;
	}

	candidates.forEach((candidate) => {
		const experiences = candidateExperience.map((experience) => ({
			occupation: experience.occupation,
			organization: experience.organization,
			duration: experience.duration,
			candidateId: candidate.id
		}));
		defaultCandidateExperience = [
			...defaultCandidateExperience,
			...experiences
		];
	});

	insertCandidateExperience(connection, defaultCandidateExperience);

	return defaultCandidateExperience;
};

export const createRandomCandidateExperience = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<Map<Candidate, CandidateExperience[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateExperience will not be created'
		);
		return;
	}

	let candidateExperiences = [];
	const candidateExperienceMap: Map<Candidate, any[]> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const experiences = candidateExperience.map((experience) => ({
				occupation: experience.occupation,
				organization: experience.organization,
				duration: experience.duration,
				candidateId: candidate.id
			}));

			candidateExperienceMap.set(candidate, experiences);
			candidateExperiences = [...candidateExperience, ...experiences];
		});
	});

	await insertCandidateExperience(connection, candidateExperiences);

	return candidateExperienceMap;
};

const insertCandidateExperience = async (
	connection: Connection,
	candidateExperiences: CandidateExperience[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateExperience)
		.values(candidateExperiences)
		.execute();
};
