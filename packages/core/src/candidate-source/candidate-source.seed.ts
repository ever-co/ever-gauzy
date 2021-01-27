import { Connection } from 'typeorm';
import { ICandidate } from '@gauzy/contracts';
import { CandidateSource } from './candidate-source.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_CANDIDATE_SOURCES } from './default-candidate-sources';

export const createCandidateSources = async (
	connection: Connection,
	tenant: Tenant,
	candidates: ICandidate[] | void,
	organization: Organization
): Promise<CandidateSource[]> => {
	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateSources will not be created'
		);
		return;
	}

	let defaultCandidateSources: CandidateSource[] = [];
	candidates.forEach((candidate) => {
		const rand = Math.floor(
			Math.random() * DEFAULT_CANDIDATE_SOURCES.length
		);
		const sources = {
			name: DEFAULT_CANDIDATE_SOURCES[rand].name,
			candidateId: candidate.id,
			...{ organization, tenant }
		};
		defaultCandidateSources = [...defaultCandidateSources, sources];
	});

	insertCandidateSources(connection, defaultCandidateSources);

	return defaultCandidateSources;
};

export const createRandomCandidateSources = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
): Promise<Map<ICandidate, CandidateSource[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateSources will not be created'
		);
		return;
	}

	let candidateSources = [];
	const candidateSourcesMap: Map<ICandidate, CandidateSource[]> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		const rand = Math.floor(
			Math.random() * DEFAULT_CANDIDATE_SOURCES.length
		);

		(candidates || []).forEach((candidate) => {
			const sources: any = {
				name: DEFAULT_CANDIDATE_SOURCES[rand].name,
				candidateId: candidate.id,
				...{ organization: candidate.organization, tenant }
			};

			candidateSourcesMap.set(candidate, sources);
			candidateSources = [...candidateSources, sources];
		});
	});

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
