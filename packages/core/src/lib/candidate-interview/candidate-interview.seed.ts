import { DataSource } from 'typeorm';
import { ICandidate, ICandidateInterview, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
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
	let candidateInterviews: ICandidateInterview[] = [];
	for (const tenantCandidate of candidates) {
		candidateInterviews = await dataOperation(
			dataSource,
			candidateInterviews,
			tenantCandidate,
			tenant,
			organization
		);
	}
	return candidateInterviews;
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
		const organization = faker.helpers.arrayElement(organizations);
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

		candidate.title = faker.person.jobArea();
		candidate.startTime = new Date(interViewDate.setHours(10));
		candidate.endTime = new Date(interViewDate.setHours(12));
		candidate.location = faker.location.city();
		candidate.note = faker.lorem.words();
		candidate.candidate = tenantCandidate;
		candidate.tenant = tenant;
		candidate.organization = organization;

		candidates.push(candidate);
	}
	await dataSource.manager.save(candidates);
	return candidates;
};
