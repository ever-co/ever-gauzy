import { Candidate, ICandidateFeedback } from '@gauzy/models';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { CandidateFeedback } from './candidate-feedbacks.entity';

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
	candidates: Candidate[] | void
): Promise<CandidateFeedback[]> => {
	let defaultCandidateFeedbacks = [];

	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateFeedbacks will not be created'
		);
		return;
	}

	candidates.forEach((candidate) => {
		const feedbacks = candidateFeedbackList.map((feedback) => ({
			description: feedback.description,
			rating: feedback.rating,
			candidateId: candidate.id
		}));

		defaultCandidateFeedbacks = [
			...defaultCandidateFeedbacks,
			...feedbacks
		];
	});

	insertCandidateFeedbacks(connection, defaultCandidateFeedbacks);

	return defaultCandidateFeedbacks;
};

export const createRandomCandidateFeedbacks = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<Map<Candidate, CandidateFeedback[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateFeedbacks will not be created'
		);
		return;
	}

	let candidateFeedbacks = [];
	const candidateFeedbacksMap: Map<Candidate, any[]> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const feedbacks = candidateFeedbackList.map((feedback) => ({
				description: feedback.description,
				rating: feedback.rating,
				candidateId: candidate.id
			}));

			candidateFeedbacksMap.set(candidate, feedbacks);
			candidateFeedbacks = [...candidateFeedbacks, ...feedbacks];
		});
	});

	await insertCandidateFeedbacks(connection, candidateFeedbacks);

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
