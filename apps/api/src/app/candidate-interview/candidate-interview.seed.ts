import { Candidate, ICandidateInterview } from '@gauzy/models';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { CandidateInterview } from './candidate-interview.entity';

const candidateInterviewList: ICandidateInterview[] = [
	{
		title: 'Interview 1',
		startTime: new Date(2013, 0, 24, 14, 30, 0, 0),
		endTime: new Date(2013, 0, 24, 15, 30, 0, 0),
		interviewers: [],
		location: '',
		note: ''
	},
	{
		title: 'Interview 2',
		startTime: new Date(2013, 0, 24, 14, 30, 0, 0),
		endTime: new Date(2013, 0, 24, 15, 30, 0, 0),
		interviewers: [],
		location: '',
		note: ''
	}
];
export const createCandidateInterview = async (
	connection: Connection,
	candidates: Candidate[]
): Promise<CandidateInterview[]> => {
	let defaultCandidateInterview = [];

	candidates.forEach((candidate) => {
		const interviews = candidateInterviewList.map((interview) => ({
			endTime: interview.endTime,
			location: interview.location,
			note: interview.note,
			startTime: interview.startTime,
			title: interview.title,
			interviewers: interview.interviewers,
			candidateId: candidate.id
		}));

		defaultCandidateInterview = [
			...defaultCandidateInterview,
			...interviews
		];
	});

	insertCandidateInterview(connection, defaultCandidateInterview);

	return defaultCandidateInterview;
};

export const createRandomCandidateInterview = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, Candidate[]>
): Promise<Map<Candidate, CandidateInterview[]>> => {
	let candidateInterview = [];
	const candidateInterviewMap: Map<
		Candidate,
		CandidateInterview[]
	> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const interviews = candidateInterviewList.map((interview) => ({
				endTime: interview.endTime,
				location: interview.location,
				note: interview.note,
				startTime: interview.startTime,
				title: interview.title,
				interviewers: interview.interviewers,
				candidateId: candidate.id
			}));

			candidateInterviewMap.set(candidate, interviews);
			candidateInterview = [...candidateInterview, ...interviews];
		});
	});

	await insertCandidateInterview(connection, candidateInterview);

	return candidateInterviewMap;
};

const insertCandidateInterview = async (
	connection: Connection,
	candidateInterview: CandidateInterview[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateInterview)
		.values(candidateInterview)
		.execute();
};
