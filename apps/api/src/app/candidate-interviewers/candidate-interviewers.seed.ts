import { Candidate, ICandidateInterviewers } from '@gauzy/models';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { CandidateInterviewers } from './candidate-interviewers.entity';

const candidateInterviewersList: ICandidateInterviewers[] = [
	{
		interviewId: '',
		employeeId: ''
	},
	{
		interviewId: '',
		employeeId: ''
	}
];
export const createCandidateInterviewers = async (
	connection: Connection,
	candidates: Candidate[]
): Promise<CandidateInterviewers[]> => {
	let defaultCandidateInterviewers = [];

	candidates.forEach((candidate) => {
		const interviewers = candidateInterviewersList.map((interviewer) => ({
			interviewId: interviewer.interviewId,
			employeeId: interviewer.employeeId
		}));

		defaultCandidateInterviewers = [
			...defaultCandidateInterviewers,
			...interviewers
		];
	});

	insertCandidateInterviewers(connection, defaultCandidateInterviewers);

	return defaultCandidateInterviewers;
};

export const createRandomCandidateInterviewers = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, Candidate[]>
): Promise<Map<Candidate, CandidateInterviewers[]>> => {
	let candidateInterviewers = [];
	const candidateInterviewersMap: Map<
		Candidate,
		CandidateInterviewers[]
	> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const interviewers = candidateInterviewersList.map(
				(interviewer) => ({
					interviewId: interviewer.interviewId,
					employeeId: interviewer.employeeId
				})
			);

			candidateInterviewersMap.set(candidate, interviewers);
			candidateInterviewers = [...candidateInterviewers, ...interviewers];
		});
	});

	await insertCandidateInterviewers(connection, candidateInterviewers);

	return candidateInterviewersMap;
};

const insertCandidateInterviewers = async (
	connection: Connection,
	candidateInterviewers: CandidateInterviewers[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateInterviewers)
		.values(candidateInterviewers)
		.execute();
};
