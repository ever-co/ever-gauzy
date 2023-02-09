import { DataSource } from 'typeorm';
import { ICandidate, ICandidateInterview, ICandidatePersonalQualities, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

export const createDefaultCandidatePersonalQualities = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	defaultCandidates
): Promise<CandidatePersonalQualities[]> => {
	if (!defaultCandidates) {
		console.warn(
			'Warning: defaultCandidates not found, default Candidate Personal Qualities will not be created'
		);
		return;
	}

	let candidates: CandidatePersonalQualities[] = [];
	for (const tenantCandidate of defaultCandidates) {
		const { id: candidateId } = tenantCandidate;
		const candidateInterviews = await dataSource.manager.findBy(CandidateInterview, {
			candidateId
		});
		candidates = await dataOperation(
			dataSource,
			tenant,
			organization,
			candidates,
			candidateInterviews
		);
	}
	return candidates;
};

export const createRandomCandidatePersonalQualities = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<CandidatePersonalQualities[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidatePersonalQualities will not be created'
		);
		return;
	}

	let candidates: CandidatePersonalQualities[] = [];
	for (const tenant of tenants) {
		const tenantCandidates = tenantCandidatesMap.get(tenant);
		for (const tenantCandidate of tenantCandidates) {
			const { id: candidateId } = tenantCandidate;
			const candidateInterviews = await dataSource.manager.findBy(CandidateInterview, {
				candidateId
			});
			candidates = await dataOperation(
				dataSource,
				tenant,
				tenantCandidate.organization,
				candidates,
				candidateInterviews
			);
		}
	}
	return candidates;
};

const dataOperation = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	candidates: ICandidatePersonalQualities[],
	candidateInterviews: ICandidateInterview[]
) => {
	for (const interview of candidateInterviews) {
		const candidate = new CandidatePersonalQualities();

		candidate.name = faker.person.jobArea();
		candidate.interviewId = interview.id;
		candidate.rating = Math.floor(Math.random() * 5) + 1;
		candidate.interview = interview;
		candidate.tenant = tenant;
		candidate.organization = organization;

		candidates.push(candidate);
	}
	await dataSource.manager.save(candidates);
	return candidates;
};
