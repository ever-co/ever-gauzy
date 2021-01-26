import { ICandidate, CandidateStatus } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import * as faker from 'faker';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_CANDIDATE_FEEDBACKS } from './default-candidate-feedbacks';

export const createCandidateFeedbacks = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization,
	candidates: ICandidate[] | void
): Promise<Map<ICandidate, CandidateFeedback[]>> => {
	let candidateFeedbacksMap: Map<ICandidate, any[]> = new Map();

	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateFeedbacks will not be created'
		);
		return;
	}
	candidateFeedbacksMap = await dataOperation(
		connection,
		tenant,
		organization,
		[],
		candidateFeedbacksMap,
		candidates
	);

	return candidateFeedbacksMap;
};

export const createRandomCandidateFeedbacks = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
): Promise<Map<ICandidate, CandidateFeedback[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateFeedbacks will not be created'
		);
		return;
	}

	const candidateFeedbacks = [];
	let candidateFeedbacksMap: Map<ICandidate, any[]> = new Map();

	for (const tenant of tenants) {
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
		const organization = faker.random.arrayElement(organizations);
		const candidates = tenantCandidatesMap.get(tenant);
		candidateFeedbacksMap = await dataOperation(
			connection,
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
	connection: Connection,
	candidateFeedbacks: CandidateFeedback[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateFeedback)
		.values(candidateFeedbacks)
		.execute();
};

const dataOperation = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization,
	candidateFeedbacks,
	candidateFeedbacksMap,
	candidates
) => {
	for (const candidate of candidates) {
		const candidateInterviews = await connection.manager.find(
			CandidateInterview,
			{ where: [{ candidate: candidate }] }
		);
		const interview = faker.random.arrayElement(candidateInterviews);
		const feedbacks = DEFAULT_CANDIDATE_FEEDBACKS.map((feedback) => ({
			description: feedback.description,
			rating: feedback.rating,
			candidateId: candidate.id,
			interviewId: interview.id,
			tenant: tenant,
			organization: organization,
			status: faker.random.arrayElement(Object.keys(CandidateStatus))
		}));

		candidateFeedbacksMap.set(candidate, feedbacks);
		candidateFeedbacks = [...candidateFeedbacks, ...feedbacks];
	}
	await insertCandidateFeedbacks(connection, candidateFeedbacks);
	return candidateFeedbacksMap;
};
