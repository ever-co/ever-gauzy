import { Connection } from 'typeorm';
import { Candidate, ICandidateSource } from '@gauzy/models';
import { CandidateSource } from './candidate-source.entity';
import { Tenant } from '../tenant/tenant.entity';

const candidateSourceList: ICandidateSource[] = [
	{
		name: 'LinkedIn'
	},
	{
		name: 'Indeed'
	},
	{
		name: 'Idealist'
	},
	{
		name: 'Dice'
	},
	{
		name: 'Monster'
	}
];
export const createCandidateSources = async (
	connection: Connection,
	candidates: Candidate[]
): Promise<CandidateSource[]> => {
	let defaultCandidateSources = [];

	candidates.forEach((candidate) => {
		const sources = candidateSourceList.map((source) => ({
			name: source.name,
			candidateId: candidate.id
		}));

		defaultCandidateSources = [...defaultCandidateSources, ...sources];
	});

	insertCandidateSources(connection, defaultCandidateSources);

	return defaultCandidateSources;
};

// export const createRandomCandidateSources = async (
// 	connection: Connection,
// 	tenants: Tenant[],
// 	tenantCandidatesMap: Map<Tenant, Candidate[]>
// ): Promise<Map<Candidate, CandidateSource[]>> => {
// 	let candidateSources = [];
// 	const candidateSourcesMap: Map<Candidate, CandidateSource[]> = new Map();

// 	(tenants || []).forEach((tenant) => {
// 		const candidates = tenantCandidatesMap.get(tenant);

// 		(candidates || []).forEach((candidate) => {
// 			const sources = candidateSourceList.map((source) => ({
// 				name: source.name,
// 				candidateId: candidate.id
// 			}));

// 			candidateSourcesMap.set(candidate, sources);
// 			candidateSources = [...candidateSources, ...sources];
// 		});
// 	});

// 	await insertCandidateSources(connection, candidateSources);

// 	return candidateSourcesMap;
// };

const insertCandidateSources = async (
	connection: Connection,
	candidateSources: CandidateSource[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateSource)
		.values(candidateSources)
		.execute();
};
