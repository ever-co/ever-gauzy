import { Connection } from 'typeorm';
import { CandidateSource } from './candidate_source.entity';

export const createCandidateSources = async (
	connection: Connection
): Promise<CandidateSource[]> => {
	const candidateSources: CandidateSource[] = [
		{
			name: 'LinkedIn'
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

	for (let i = 0; i < candidateSources.length; i++) {
		await insertCandidateSources(connection, candidateSources[i]);
	}

	return candidateSources;
};

const insertCandidateSources = async (
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
