import { DataSource } from 'typeorm';
import { IUser, ISeedUsers, IOrganization, ITenant, ICandidate } from '@gauzy/contracts';
import { Candidate } from './../core/entities/internal';

export const createDefaultCandidates = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	users: IUser[]
): Promise<Candidate[]> => {
	const candidates: Candidate[] = [];
	for await (const user of users) {
		const candidate = new Candidate();
		candidate.organization = organization;
		candidate.user = user;
		candidate.isArchived = false;
		candidate.tenant = tenant;
		candidates.push(candidate);
	}
	return await insertCandidates(dataSource, candidates);
};

export const createRandomCandidates = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	tenantUsersMap: Map<ITenant, ISeedUsers>,
	candidatesPerOrganization: number
): Promise<Map<ITenant, ICandidate[]>> => {
	const candidateMap: Map<ITenant, ICandidate[]> = new Map();
	for await (const tenant of tenants) {
		const candidates: Candidate[] = [];
		const randomUsers = tenantUsersMap.get(tenant).candidateUsers;
		const randomOrgs = tenantOrganizationsMap.get(tenant);
		const insertCandidatesInToOrganization = async (
			quantity: number,
			organization: IOrganization
		) => {
			for (let index = 0; index < quantity; index++) {
				const candidate = new Candidate();
				candidate.tenant = tenant;
				candidate.organization = organization;
				candidate.isArchived = false;
				candidate.user = randomUsers.pop();
				if (candidate.user) {
					candidates.push(candidate);
				}
			}
			await insertCandidates(dataSource, candidates);
		};
		for await (const org of randomOrgs) {
			if (randomUsers.length) {
				await insertCandidatesInToOrganization(
					candidatesPerOrganization,
					org
				);
			}
		}
		candidateMap.set(tenant, candidates);
	}
	return candidateMap;
};

const insertCandidates = async (
	dataSource: DataSource,
	candidates: Candidate[]
): Promise<Candidate[]> => {
	return await dataSource.manager.save(candidates);
};
