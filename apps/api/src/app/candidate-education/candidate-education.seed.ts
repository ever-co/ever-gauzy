import { ICandidate } from '@gauzy/models';
import { Connection } from 'typeorm';
import { CandidateEducation } from './candidate-education.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import * as faker from 'faker';
import { DEFAULT_CANDIDATE_EDUCATIONS } from './default-candidate-educations';

export const createCandidateEducations = async (
	connection: Connection,
	candidates: ICandidate[] | void
): Promise<CandidateEducation[]> => {
	let defaultCandidateEducation = [];

	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateEducation will not be created'
		);
		return;
	}
	candidates.forEach((candidate) => {
		const educations = DEFAULT_CANDIDATE_EDUCATIONS.map((education) => ({
			schoolName: education.schoolName,
			degree: education.degree,
			completionDate: education.completionDate,
			field: education.field,
			candidateId: candidate.id,
			organization: candidate.organization,
			tenant: candidate.tenant,
			notes: faker.lorem.sentence()
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
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
): Promise<Map<ICandidate, CandidateEducation[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateEducation will not be created'
		);
		return;
	}

	let candidateEducation = [];
	const candidateEducationsMap: Map<ICandidate, any[]> = new Map();

	for await (const tenant of tenants || []) {
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const educations = DEFAULT_CANDIDATE_EDUCATIONS.map(
				(education) => ({
					schoolName: education.schoolName,
					degree: education.degree,
					completionDate: education.completionDate,
					field: education.field,
					candidateId: candidate.id,
					organization: faker.random.arrayElement(organizations),
					tenant: tenant,
					notes: faker.lorem.sentence()
				})
			);
			candidateEducationsMap.set(candidate, educations);
			candidateEducation = [
				...DEFAULT_CANDIDATE_EDUCATIONS,
				...educations
			];
		});
	}

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
