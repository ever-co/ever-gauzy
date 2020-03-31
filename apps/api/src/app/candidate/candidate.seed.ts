import { Tenant } from '../tenant';
import { Connection } from 'typeorm';
import { User } from '../user';
import { environment as env } from '@env-api/environment';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';

export const createCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant[];
		org: Organization;
		users: User[];
	},
	randomData: {
		orgs: Organization[];
		users: User[];
		// tenant: Tenant[];
	}
): Promise<{
	defaultCandidates: Candidate[];
	randomCandidates: Candidate[];
}> => {
	const defaultCandidates: Candidate[] = await createDefaultCandidates(
		connection,
		defaultData
	);

	const randomCandidates: Candidate[] = await createRandomCandidates(
		connection,
		randomData
	);

	return { defaultCandidates, randomCandidates };
};

const createDefaultCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant[];
		org: Organization;
		users: User[];
	}
): Promise<Candidate[]> => {
	const defaultCandidates = env.defaultCandidates || [];
	let candidate: Candidate;
	const candidates: Candidate[] = [];
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;
	const defaultTenants = defaultData.tenant;

	console.dir(defaultTenants);
	let counter = 0;
	for (const user of defaultUsers) {
		candidate = new Candidate();
		candidate.organization = defaultOrg;
		candidate.user = user;
		candidate.tenant = defaultTenants[counter];
		candidate.candidateLevel = defaultCandidates.filter(
			(e) => e.email === candidate.user.email
		)[0].candidateLevel;

		await insertCandidate(connection, candidate);
		candidates.push(candidate);
		counter++;
	}

	console.dir(candidates);
	return candidates;
};

const createRandomCandidates = async (
	connection: Connection,
	randomData: {
		orgs: Organization[];
		users: User[];
	}
): Promise<Candidate[]> => {
	let candidate: Candidate;
	const candidates: Candidate[] = [];
	const randomUsers = randomData.users;
	const randomOrgs = randomData.orgs;

	const averageUsersCount = Math.ceil(randomUsers.length / randomOrgs.length);

	for (const orgs of randomOrgs) {
		if (randomUsers.length) {
			for (let index = 0; index < averageUsersCount; index++) {
				candidate = new Candidate();
				candidate.organization = orgs;
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
