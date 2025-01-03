import { DataSource } from 'typeorm';
import {
	ICandidate,
	ICandidateCriterionsRating,
	ICandidateFeedback,
	ICandidatePersonalQualities,
	ICandidateTechnologies,
	IOrganization,
	ITenant
} from '@gauzy/contracts';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import {
	CandidateFeedback,
	CandidateInterview,
	CandidatePersonalQualities,
	CandidateTechnologies
} from './../core/entities/internal';

export const createDefaultCandidateCriterionRating = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	defaultCandidates
): Promise<CandidateCriterionsRating[]> => {
	if (!defaultCandidates) {
		console.warn(
			'Warning: defaultCandidates not found, default Criterion rating  will not be created'
		);
		return;
	}

	let candidates: CandidateCriterionsRating[] = [];
	for (const defaultCandidate of defaultCandidates) {
		const { id: candidateId } = defaultCandidate;
		const candidateInterviews = await dataSource.manager.findBy(CandidateInterview, {
			candidateId
		});
		for (const interview of candidateInterviews) {
			const { id: interviewId } = interview;
			const candidatesFeedbacks = await dataSource.manager.findBy(CandidateFeedback, {
				candidateId
			});
			const candidatesPersonalQualities = await dataSource.manager.findBy(CandidatePersonalQualities, {
				interviewId
			});
			const candidatesTechnologies = await dataSource.manager.findBy(CandidateTechnologies, {
				interviewId
			});
			candidates = await dataOperation(
				dataSource,
				tenant,
				organization,
				candidates,
				candidatesFeedbacks,
				candidatesTechnologies,
				candidatesPersonalQualities
			);
		}
	}

	return candidates;
};

export const createRandomCandidateCriterionRating = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<CandidateCriterionsRating[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, Criterion rating  will not be created'
		);
		return;
	}

	let candidates: CandidateCriterionsRating[] = [];

	for (const tenant of tenants) {
		const tenantCandidates = tenantCandidatesMap.get(tenant);
		for (const tenantCandidate of tenantCandidates) {
			const { id: candidateId } = tenantCandidate;
			const candidateInterviews = await dataSource.manager.findBy(CandidateInterview, {
				candidateId: candidateId
			});
			for (const interview of candidateInterviews) {
				const { id: interviewId } = interview;
				const candidatesFeedbacks = await dataSource.manager.findBy(CandidateFeedback, {
					candidateId
				});
				const candidatesPersonalQualities = await dataSource.manager.findBy(CandidatePersonalQualities, {
					interviewId
				});
				const candidatesTechnologies = await dataSource.manager.findBy(CandidateTechnologies, {
					interviewId
				});
				candidates = await dataOperation(
					dataSource,
					tenant,
					interview.organization,
					candidates,
					candidatesFeedbacks,
					candidatesTechnologies,
					candidatesPersonalQualities
				);
			}
		}
	}
	return candidates;
};

const dataOperation = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	candidates: ICandidateCriterionsRating[],
	candidatesFeedbacks: ICandidateFeedback[],
	candidatesTechnologies: ICandidateTechnologies[],
	candidatesPersonalQualities: ICandidatePersonalQualities[]
) => {
	for (const feedback of candidatesFeedbacks) {
		const candidate = new CandidateCriterionsRating();
		candidate.rating = Math.floor(Math.random() * 5) + 1;
		candidate.technologyId = candidatesTechnologies[0].id;
		candidate.personalQualityId = candidatesPersonalQualities[0].id;
		candidate.feedback = feedback;
		candidate.tenant = tenant;
		candidate.organization = organization;
		candidates.push(candidate);
	}
	await dataSource.manager.save(candidates);
	return candidates;
};
