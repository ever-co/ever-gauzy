import { Connection } from 'typeorm';
import { CandidateCv } from './candidate-cv.entity';

export const createCandidateCvs = async (
	connection: Connection
): Promise<CandidateCv[]> => {
	const candidateCv: CandidateCv[] = [
		{
			name: 'Test',
			cvUrl: 'test/test/test'
		},
		{
			name: 'Test2',
			cvUrl: 'test/test/test2'
		},
		{
			name: 'Test3',
			cvUrl: 'test/test/test3'
		},
		{
			name: 'Test4',
			cvUrl: 'test/test/test4'
		},
		{
			name: 'Test5',
			cvUrl: 'test/test/test5	'
		}
	];

	for (let i = 0; i < candidateCv.length; i++) {
		await insertCandidateSourses(connection, candidateCv[i]);
	}

	return candidateCv;
};

const insertCandidateSourses = async (
	connection: Connection,
	candidateCv: CandidateCv
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateCv)
		.values(candidateCv)
		.execute();
};
