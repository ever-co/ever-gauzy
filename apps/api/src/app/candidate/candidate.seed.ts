import { Connection } from 'typeorm';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { User, ISeedUsers } from '@gauzy/models';
import { CandidateSource } from '../candidate_source/candidate_source.entity';

export const createDefaultCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant;
		org: Organization;
		users: User[];
	}
): Promise<Candidate[]> => {
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
	source: CandidateSource[],
	candidatesPerOrganization: number
): Promise<void> => {
	for (const tenant of tenants) {
		let candidate: Candidate;
		const candidates: Candidate[] = [];
		const randomUsers = tenantUsersMap.get(tenant).candidateUsers;
		const randomOrgs = tenantOrganizationsMap.get(tenant);
		// const averageUsersCount = Math.ceil(randomUsers.length / randomOrgs.length);

		const insertCandidatesInToOrganization = async (
			quantity: number,
			organization: Organization
		) => {
			for (let index = 0; index < quantity; index++) {
				candidate = new Candidate();
				candidate.organization = organization;
				candidate.source = source[0].id;
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
	}

	return;
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
