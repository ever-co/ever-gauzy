import { DataSource } from 'typeorm';
import { ICandidate, ICandidateSource, IOrganization, ITenant } from '@gauzy/contracts';
import { DEFAULT_CANDIDATE_SOURCES } from './default-candidate-sources';
import { CandidateSource } from './../core/entities/internal';

export const createCandidateSources = async (
	dataSource: DataSource,
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
	await insertCandidateSources(dataSource, defaultCandidateSources);
	return defaultCandidateSources;
};

export const createRandomCandidateSources = async (
	dataSource: DataSource,
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
	await insertCandidateSources(dataSource, candidateSources);
	return candidateSourcesMap;
};

const insertCandidateSources = async (
	dataSource: DataSource,
	candidateSources: CandidateSource[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(CandidateSource)
		.values(candidateSources)
		.execute();
};
