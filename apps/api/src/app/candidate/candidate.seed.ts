import { Connection } from 'typeorm';
import { Candidate } from './candidate.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { User, ISeedUsers, LanguagesEnum } from '@gauzy/models';
import { CandidateSource } from '../candidate-source/candidate-source.entity';
import * as faker from 'faker';

export const createDefaultCandidates = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant;
		org: Organization;
		users: User[];
	}
): Promise<Candidate[]> => {
	const defaultCandidates = [
		{
			email: 'john@ever.co',
			password: '123456',
			firstName: 'John',
			lastName: 'Smith',
			imageUrl: 'assets/images/avatars/alish.jpg',
			candidateLevel: 'D',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'jaye@ever.co',
			password: '123456',
			firstName: 'Jaye',
			lastName: 'Jeffreys',
			imageUrl: 'assets/images/avatars/alexander.jpg',
			candidateLevel: 'B',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'kasey@ever.co',
			password: '123456',
			firstName: 'Kasey',
			lastName: 'Kraker',
			imageUrl: 'assets/images/avatars/rachit.png',
			candidateLevel: null,
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'norris@ever.co',
			password: '123456',
			firstName: 'Norris ',
			lastName: 'Nesbit',
			imageUrl: 'assets/images/avatars/atanas.jpeg',
			candidateLevel: 'A',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'estella@ever.co',
			password: '123456',
			firstName: 'Estella',
			lastName: 'Ennis',
			imageUrl: 'assets/images/avatars/dimana.jpeg',
			candidateLevel: null,
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'greg@ever.co',
			password: '123456',
			firstName: 'Greg ',
			lastName: 'Grise',
			imageUrl: 'assets/images/avatars/savov.jpg',
			candidateLevel: 'A',
			preferredLanguage: LanguagesEnum.ENGLISH
		}
	];
	const defaultSources = await connection.manager.find(CandidateSource);

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
		candidate.isArchived = false;
		candidate.tenant = defaultTenant;
		// candidate.source = faker.random.arrayElement(defaultSources);
		// candidate.source = defaultCandidates.filter(
		// 	(e) => e.email === candidate.user.email
		// )[0].source;

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
	const defaultSources = await connection.manager.find(CandidateSource);
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
				// candidate.source = faker.random.arrayElement(defaultSources);
				candidate.tenant = tenant;
				candidate.organization = organization;
				candidate.isArchived = false;
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
