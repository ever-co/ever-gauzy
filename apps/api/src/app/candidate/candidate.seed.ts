import { Connection } from 'typeorm';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { User, ISeedUsers } from '@gauzy/models';
import { environment as env } from '@env-api/environment';
export const createDefaultCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant;
		org: Organization;
		users: User[];
	}
): Promise<Candidate[]> => {
	const defaultCandidates = env.defaultCandidates || [];
	let candidate: Candidate;
	const candidates: Candidate[] = [];
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;
	const defaultTenant = defaultData.tenant;

	let counter = 0;
	for (const user of defaultUsers) {
		candidate = new Candidate();
		candidate.organization = defaultOrg;
		candidate.user = user;
		candidate.tenant = defaultTenant;
		candidate.source = defaultCandidates.filter(
			(e) => e.email === candidate.user.email
		)[0].source;

		await insertCandidate(connection, candidate);
		candidates.push(candidate);
		counter++;
	}
	return candidates;
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
		let candidate: Candidate;
		const candidates: Candidate[] = [];
		const randomUsers = tenantUsersMap.get(tenant).candidateUsers;
		const randomOrgs = tenantOrganizationsMap.get(tenant);
		const insertCandidatesInToOrganization = async (
			quantity: number,
			organization: Organization
		) => {
			for (let index = 0; index < quantity; index++) {
				candidate = new Candidate();
				candidate.organization = organization;
				candidate.isActive = true;
				candidate.user = randomUsers.pop();
				if (candidate.user) {
					await insertCandidate(connection, candidate);
					candidates.push(candidate);
				}
			}
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

const insertCandidate = async (
	connection: Connection,
	candidate: Candidate
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Candidate)
		.values(candidate)
		.execute();
};
