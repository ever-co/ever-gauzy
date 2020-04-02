import { Connection } from 'typeorm';
import { User } from '../user';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';

export const createCandidates = async (
	connection: Connection,
	randomData: {
		org: Organization;
		orgs: Organization[];
		users: User[];
	}
): Promise<{
	randomCandidates: Candidate[];
}> => {
	const randomCandidates: Candidate[] = await createRandomCandidates(
		connection,
		randomData
	);

	return { randomCandidates };
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

	const averageUsersCount = Math.ceil(randomUsers.length / randomOrgs.length);
	const organization = randomData.org;
	for (const orgs of randomOrgs) {
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
