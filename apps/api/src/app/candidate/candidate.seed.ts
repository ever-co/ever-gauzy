import { Connection } from 'typeorm';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { User } from '@gauzy/models';
import { CandidateSource } from '../candidate_source/candidate_source.entity';
import { CandidateCv } from '../candidate-cv/candidate-cv.entity';

export const createCandidates = async (
	connection: Connection,
	defaultData?: {
		tenant: Tenant;
		org: Organization;
		users: User[];
	},
	randomData?: {
		cvs: CandidateCv[];
		source: CandidateSource[];
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

const createRandomCandidates = async (
	connection: Connection,
	randomData: {
		source: CandidateSource[];
		org: Organization;
		orgs: Organization[];
		users: User[];
	}
): Promise<Candidate[]> => {
	const quantity = 100;
	let candidate: Candidate;
	const candidates: Candidate[] = [];
	const randomUsers = randomData.users;
	const randomOrgs = randomData.orgs;
	const organization = randomData.org;
	const candidate_source = randomData.source;
	// const averageUsersCount = Math.ceil(randomUsers.length / randomOrgs.length);

	const insertCandidatesInToOrganization = async (
		quantity: number,
		organization: Organization
	) => {
		for (let index = 0; index < quantity; index++) {
			candidate = new Candidate();
			candidate.organization = organization;
			candidate.source = candidate_source[0].id;
			candidate.user = randomUsers.pop();
			if (candidate.user) {
				await insertCandidate(connection, candidate);
				candidates.push(candidate);
			}
		}
	};
	await insertCandidatesInToOrganization(quantity, organization);
	for (const org of randomOrgs) {
		if (randomUsers.length) {
			await insertCandidatesInToOrganization(quantity, org);
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
