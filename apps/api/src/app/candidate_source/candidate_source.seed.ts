import { Connection } from 'typeorm';
import { CandidateSource } from './candidate_source.entity';

export const createCandidateSourses = async (
	connection: Connection
): Promise<CandidateSource[]> => {
	const candidateSourses: CandidateSource[] = [
		{
			name: ' LinkDin'
		},
		{
			name: 'Djiny'
		},
		{
			name: 'Relocate'
		},
		{
			name: 'Stack Overflow'
		},
		{
			name: 'Hired'
		}
	];

	for (let i = 0; i < candidateSourses.length; i++) {
		await insertCandidateSourses(connection, candidateSourses[i]);
	}

	return candidateSourses;
};

const insertCandidateSourses = async (
	connection: Connection,
	candidateSource: CandidateSource
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateSource)
		.values(candidateSource)
		.execute();
};
