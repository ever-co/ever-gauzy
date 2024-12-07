import { DataSource } from 'typeorm';
import { ICandidate, ICandidateInterview, ICandidateTechnologies, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { CandidateInterview } from './../core/entities/internal';

export const createDefaultCandidateTechnologies = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	defaultCandidates
): Promise<CandidateTechnologies[]> => {
	if (!defaultCandidates) {
		console.warn(
			'Warning: defaultCandidates not found, Default Candidate Feedbacks will not be created'
		);
		return;
	}

	let candidates: CandidateTechnologies[] = [];
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

export const createRandomCandidateTechnologies = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<CandidateTechnologies[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateFeedbacks will not be created'
		);
		return;
	}

	let candidates: CandidateTechnologies[] = [];
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
	candidates: ICandidateTechnologies[],
	candidateInterviews: ICandidateInterview[]
) => {
	for (const interview of candidateInterviews) {
		const candidate = new CandidateTechnologies();

		candidate.name = faker.person.jobArea();
		candidate.interviewId = interview.id;
		candidate.rating = Math.floor(Math.random() * 5) + 1;
		candidate.tenant = tenant;
		candidate.organization = organization;

		candidates.push(candidate);
	}
	await dataSource.manager.save(candidates);
	return candidates;
};
