import { Connection } from 'typeorm';
import { User } from '../user';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from 'libs/models/src/lib/tenant.model';

export const createCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant[];
		org: Organization;
		users: User[];
	},
	randomData: {
		org: Organization;
		orgs: Organization[];
		users: User[];
	}
): Promise<{
	randomCandidates: Candidate[];
	defaultCandidates: Candidate[];
}> => {
	const defaultCandidates: Candidate[] = await createDefaultCandidates(
		connection,
		defaultData
	);
	const randomCandidates: Candidate[] = await createRandomCandidates(
		connection,
		randomData
	);

	return { randomCandidates, defaultCandidates };
};
const createDefaultCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant[];
		org: Organization;
		users: User[];
	}
): Promise<Candidate[]> => {
	let candidate: Candidate;
	const candidates: Candidate[] = [];
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;
	const defaultTenants = defaultData.tenant;

	let counter = 0;
	for (const user of defaultUsers) {
		candidate = new Candidate();
		candidate.organization = defaultOrg;
		candidate.user = user;
		candidate.tenant = defaultTenants[counter];

		await insertCandidate(connection, candidate);
		candidates.push(candidate);
		counter++;
	}
	return candidates;
};

const createRandomCandidates = async (
	connection: Connection,
	randomData: {
		org: Organization;
		orgs: Organization[];
		users: User[];
	}
): Promise<Candidate[]> => {
	let candidate: Candidate;
	const candidates: Candidate[] = [];
	const randomUsers = randomData.users;
	const randomOrgs = randomData.orgs;
	const organization = randomData.org;
	const averageUsersCount = Math.ceil(randomUsers.length / randomOrgs.length);

	for (let i = 0; i < randomOrgs.length; i++) {
		if (randomUsers.length) {
			for (let index = 0; index < averageUsersCount; index++) {
				candidate = new Candidate();
				candidate.organization = organization;
				candidate.user = randomUsers.pop();
				if (candidate.user) {
					await insertCandidate(connection, candidate);
					candidates.push(candidate);
				}
			}
		}
	}
	return candidates;
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
