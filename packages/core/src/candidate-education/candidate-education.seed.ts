import { ICandidate, ICandidateEducation, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import * as faker from 'faker';
import { DEFAULT_CANDIDATE_EDUCATIONS } from './default-candidate-educations';
import { CandidateEducation, Organization } from './../core/entities/internal';

export const createCandidateEducations = async (
	connection: Connection,
	tenant: ITenant,
	candidates: ICandidate[] | void
): Promise<CandidateEducation[]> => {
	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateEducation will not be created'
		);
		return;
	}
	let defaultCandidateEducation = [];
	for (const candidate of candidates) {
		const educations = DEFAULT_CANDIDATE_EDUCATIONS.map((education) => ({
			schoolName: education.schoolName,
			degree: education.degree,
			completionDate: education.completionDate,
			field: education.field,
			candidateId: candidate.id,
			organization: candidate.organization,
			tenant: tenant,
			notes: faker.lorem.sentence()
		}));
		defaultCandidateEducation = [
			...defaultCandidateEducation,
			...educations
		];
	}
	await insertCandidateEducations(connection, defaultCandidateEducation);
	return defaultCandidateEducation;
};

export const createRandomCandidateEducations = async (
	connection: Connection,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<Map<ICandidate, ICandidateEducation[]>> => {
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
		for (const candidate of candidates) {
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
		}
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
