import { Connection } from 'typeorm';
import { ICandidate, ICandidateSource, IOrganization, ITenant } from '@gauzy/contracts';
import { DEFAULT_CANDIDATE_SOURCES } from './default-candidate-sources';
import { CandidateSource } from './../core/entities/internal';

export const createCandidateSources = async (
	connection: Connection,
	tenant: ITenant,
	candidates: ICandidate[] | void,
	organization: IOrganization
): Promise<CandidateSource[]> => {
	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateSources will not be created'
		);
		return;
	}

	let defaultCandidateSources: CandidateSource[] = [];
	for (const candidate of candidates) {
		const rand = Math.floor(
			Math.random() * DEFAULT_CANDIDATE_SOURCES.length
		);
		const sources = {
			name: DEFAULT_CANDIDATE_SOURCES[rand].name,
			candidateId: candidate.id,
			...{ organization, tenant }
		};
		defaultCandidateSources = [...defaultCandidateSources, sources];
	}
	await insertCandidateSources(connection, defaultCandidateSources);
	return defaultCandidateSources;
};

export const createRandomCandidateSources = async (
	connection: Connection,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<Map<ICandidate, ICandidateSource[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateSources will not be created'
		);
		return;
	}

	let candidateSources = [];
	const candidateSourcesMap: Map<ICandidate, ICandidateSource[]> = new Map();
	for (const tenant of tenants) {
		const candidates = tenantCandidatesMap.get(tenant);
		const rand = Math.floor(Math.random() * DEFAULT_CANDIDATE_SOURCES.length);
		for (const candidate of candidates) {
			const sources: any = {
				name: DEFAULT_CANDIDATE_SOURCES[rand].name,
				candidateId: candidate.id,
				...{ organization: candidate.organization, tenant }
			};
			candidateSourcesMap.set(candidate, sources);
			candidateSources = [...candidateSources, sources];
		}
	}
	await insertCandidateSources(connection, candidateSources);
	return candidateSourcesMap;
};

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
