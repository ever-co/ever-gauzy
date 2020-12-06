import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ICandidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateInterview } from './candidate-interview.entity';
import { Organization } from '../organization/organization.entity';

export const createDefaultCandidateInterview = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization,
	candidates
): Promise<CandidateInterview[]> => {
	if (!candidates) {
		console.warn(
			'Warning: Candidates not found, Default Candidate Interview will not be created'
		);
		return;
	}

	let candidateInterviewes: CandidateInterview[] = [];
	for (const tenantCandidate of candidates) {
		candidateInterviewes = await dataOperation(
			connection,
			candidateInterviewes,
			tenantCandidate,
			tenant,
			organization
		);
	}

	return candidateInterviewes;
};

export const createRandomCandidateInterview = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
): Promise<CandidateInterview[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateInterview will not be created'
		);
		return;
	}

	let candidates: CandidateInterview[] = [];
	for (const tenant of tenants) {
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
		const organization = faker.random.arrayElement(organizations);
		const tenantCandidates = tenantCandidatesMap.get(tenant);
		for (const tenantCandidate of tenantCandidates) {
			candidates = await dataOperation(
				connection,
				candidates,
				tenantCandidate,
				tenant,
				organization
			);
		}
	}
	return candidates;
};

const dataOperation = async (
	connection: Connection,
	candidates,
	tenantCandidate,
	tenant: Tenant,
	organization: Organization
) => {
	for (let i = 0; i <= Math.floor(Math.random() * 3) + 1; i++) {
		const candidate = new CandidateInterview();
		const interViewDate = faker.date.past();

		candidate.title = faker.name.jobArea();
		candidate.startTime = new Date(interViewDate.setHours(10));
		candidate.endTime = new Date(interViewDate.setHours(12));
		candidate.location = faker.address.city();
		candidate.note = faker.lorem.words();
		candidate.candidate = tenantCandidate;
		candidate.tenant = tenant;
		candidate.organization = organization;

		candidates.push(candidate);
	}
	await connection.manager.save(candidates);
	return candidates;
};
