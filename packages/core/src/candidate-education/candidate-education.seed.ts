import { ICandidate, ICandidateEducation, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { DEFAULT_CANDIDATE_EDUCATIONS } from './default-candidate-educations';
import { CandidateEducation, Organization } from './../core/entities/internal';

export const createCandidateEducations = async (
	dataSource: DataSource,
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
		const { id: candidateId } = candidate;
		const educations = DEFAULT_CANDIDATE_EDUCATIONS.map((education) => ({
			schoolName: education.schoolName,
			degree: education.degree,
			completionDate: education.completionDate,
			field: education.field,
			candidateId: candidateId,
			organization: candidate.organization,
			tenant: tenant,
			notes: faker.lorem.sentence()
		}));
		defaultCandidateEducation = [
			...defaultCandidateEducation,
			...educations
		];
	}
	await insertCandidateEducations(dataSource, defaultCandidateEducation);
	return defaultCandidateEducation;
};

export const createRandomCandidateEducations = async (
	dataSource: DataSource,
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
		const { id: tenantId } = tenant;
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		const candidates = tenantCandidatesMap.get(tenant);
		for (const candidate of candidates) {
			const { id: candidateId } = candidate;
			const educations = DEFAULT_CANDIDATE_EDUCATIONS.map(
				(education) => ({
					schoolName: education.schoolName,
					degree: education.degree,
					completionDate: education.completionDate,
					field: education.field,
					candidateId: candidateId,
					organization: faker.helpers.arrayElement(organizations),
					tenantId: tenantId,
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
	await insertCandidateEducations(dataSource, candidateEducation);
	return candidateEducationsMap;
};

const insertCandidateEducations = async (
	dataSource: DataSource,
	educations: CandidateEducation[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(CandidateEducation)
		.values(educations)
		.execute();
};
