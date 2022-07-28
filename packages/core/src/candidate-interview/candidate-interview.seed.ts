import { DataSource } from 'typeorm';
import { ICandidate, ICandidateInterview, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@ever-co/faker';
import { CandidateInterview, Organization } from './../core/entities/internal';

export const createDefaultCandidateInterview = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	candidates
): Promise<CandidateInterview[]> => {
	if (!candidates) {
		console.warn(
			'Warning: Candidates not found, Default Candidate Interview will not be created'
		);
		return;
	}
	let candidateInterviewes: ICandidateInterview[] = [];
	for (const tenantCandidate of candidates) {
		candidateInterviewes = await dataOperation(
			dataSource,
			candidateInterviewes,
			tenantCandidate,
			tenant,
			organization
		);
	}
	return candidateInterviewes;
};

export const createRandomCandidateInterview = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<CandidateInterview[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateInterview will not be created'
		);
		return;
	}
	let candidates: ICandidateInterview[] = [];
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		const organization = faker.random.arrayElement(organizations);
		const tenantCandidates = tenantCandidatesMap.get(tenant);
		for (const tenantCandidate of tenantCandidates) {
			candidates = await dataOperation(
				dataSource,
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
	dataSource: DataSource,
	candidates: ICandidateInterview[],
	tenantCandidate: ICandidate,
	tenant: ITenant,
	organization: IOrganization
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
	await dataSource.manager.save(candidates);
	return candidates;
};
