import { ICandidate, CandidateStatus, ICandidateFeedback, IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import * as faker from 'faker';
import { DEFAULT_CANDIDATE_FEEDBACKS } from './default-candidate-feedbacks';
import { CandidateFeedback, CandidateInterview, Organization } from './../core/entities/internal';

export const createCandidateFeedbacks = async (
	connection: Connection,
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
		const organizations = await connection.manager.find(Organization, {
			where: { 
				tenant: tenant 
			}
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
	tenant: ITenant,
	organization: IOrganization,
	candidateFeedbacks,
	candidateFeedbacksMap,
	candidates
) => {
	for (const candidate of candidates) {
		const candidateInterviews = await connection.manager.find(CandidateInterview, { 
			where: { 
				candidate: candidate 
			}
		});
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
