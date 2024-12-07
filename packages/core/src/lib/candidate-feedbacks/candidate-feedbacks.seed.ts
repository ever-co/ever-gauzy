import { DataSource } from 'typeorm';
import { ICandidate, CandidateStatusEnum, ICandidateFeedback, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { DEFAULT_CANDIDATE_FEEDBACKS } from './default-candidate-feedbacks';
import { CandidateFeedback, CandidateInterview, Organization } from './../core/entities/internal';

export const createCandidateFeedbacks = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	candidates: ICandidate[] | void
): Promise<Map<ICandidate, ICandidateFeedback[]>> => {
	let candidateFeedbacksMap: Map<ICandidate, any[]> = new Map();
	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateFeedbacks will not be created'
		);
		return;
	}
	candidateFeedbacksMap = await dataOperation(
		dataSource,
		tenant,
		organization,
		[],
		candidateFeedbacksMap,
		candidates
	);
	return candidateFeedbacksMap;
};

export const createRandomCandidateFeedbacks = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<Map<ICandidate, ICandidateFeedback[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateFeedbacks will not be created'
		);
		return;
	}
	const candidateFeedbacks = [];
	let candidateFeedbacksMap: Map<ICandidate, any[]> = new Map();
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		const organization = faker.helpers.arrayElement(organizations);
		const candidates = tenantCandidatesMap.get(tenant);
		candidateFeedbacksMap = await dataOperation(
			dataSource,
			tenant,
			organization,
			candidateFeedbacks,
			candidateFeedbacksMap,
			candidates
		);
	}
	return candidateFeedbacksMap;
};

const insertCandidateFeedbacks = async (
	dataSource: DataSource,
	candidateFeedbacks: CandidateFeedback[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(CandidateFeedback)
		.values(candidateFeedbacks)
		.execute();
};

const dataOperation = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	candidateFeedbacks,
	candidateFeedbacksMap,
	candidates
) => {
	for (const candidate of candidates) {
		const { id: candidateId } = candidate;
		const candidateInterviews = await dataSource.manager.findBy(CandidateInterview, {
			candidateId
		});
		const interview = faker.helpers.arrayElement(candidateInterviews);
		const feedbacks = DEFAULT_CANDIDATE_FEEDBACKS.map((feedback) => ({
			description: feedback.description,
			rating: feedback.rating,
			candidateId: candidate.id,
			interviewId: interview.id,
			tenant: tenant,
			organization: organization,
			status: faker.helpers.arrayElement(Object.keys(CandidateStatusEnum))
		}));
		candidateFeedbacksMap.set(candidate, feedbacks);
		candidateFeedbacks = [...candidateFeedbacks, ...feedbacks];
	}
	await insertCandidateFeedbacks(dataSource, candidateFeedbacks);
	return candidateFeedbacksMap;
};
