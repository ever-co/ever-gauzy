import { Connection } from 'typeorm';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { IUser, ISeedUsers } from '@gauzy/models';

export const createDefaultCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant;
		org: Organization;
		users: IUser[];
	}
): Promise<Candidate[]> => {
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;
	const defaultTenant = defaultData.tenant;
	const candidates: Candidate[] = [];
	for (const user of defaultUsers) {
		const candidate = new Candidate();
		candidate.organization = defaultOrg;
		candidate.user = user;
		candidate.isArchived = false;
		candidate.tenant = defaultTenant;
		candidates.push(candidate);
	}
	return await insertCandidates(connection, candidates);
};

export const createRandomCandidates = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantUsersMap: Map<Tenant, ISeedUsers>,
	candidatesPerOrganization: number
): Promise<Map<Tenant, Candidate[]>> => {
	const candidateMap: Map<Tenant, Candidate[]> = new Map();
	for (const tenant of tenants) {
		const candidates: Candidate[] = [];
		const randomUsers = tenantUsersMap.get(tenant).candidateUsers;
		const randomOrgs = tenantOrganizationsMap.get(tenant);
		const insertCandidatesInToOrganization = async (
			quantity: number,
			organization: Organization
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
			await insertCandidates(connection, candidates);
		};

		for (const org of randomOrgs) {
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
	connection: Connection,
	candidates: Candidate[]
): Promise<Candidate[]> => {
	return await connection.manager.save(candidates);
};
