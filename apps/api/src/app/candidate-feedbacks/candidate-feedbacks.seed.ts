import { ICandidate, CandidateStatus, ICandidateFeedback } from '@gauzy/models';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import * as faker from 'faker';

const candidateFeedbackList: ICandidateFeedback[] = [
	{
		description: 'Feedback 1',
		rating: 4
	},
	{
		description: 'Feedback 2',
		rating: 3
	}
];
export const createCandidateFeedbacks = async (
	connection: Connection,
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

	let candidateFeedbacks = [];
	let candidateFeedbacksMap: Map<ICandidate, any[]> = new Map();

	for (let tenant of tenants) {
		const candidates = tenantCandidatesMap.get(tenant);
		candidateFeedbacksMap = await dataOperation(
			connection,
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

let dataOperation = async (
	connection: Connection,
	candidateFeedbacks,
	candidateFeedbacksMap,
	candidates
) => {
	for (let candidate of candidates) {
		const candidateInterviews = await connection.manager.find(
			CandidateInterview,
			{
				where: [{ candidate: candidate }]
			}
		);
		let interview = faker.random.arrayElement(candidateInterviews);
		const feedbacks = candidateFeedbackList.map((feedback) => ({
			description: feedback.description,
			rating: feedback.rating,
			candidateId: candidate.id,
			interviewId: interview.id,
			status: faker.random.arrayElement(Object.keys(CandidateStatus))
		}));

		candidateFeedbacksMap.set(candidate, feedbacks);
		candidateFeedbacks = [...candidateFeedbacks, ...feedbacks];
	}
	await insertCandidateFeedbacks(connection, candidateFeedbacks);
	return candidateFeedbacksMap;
};
