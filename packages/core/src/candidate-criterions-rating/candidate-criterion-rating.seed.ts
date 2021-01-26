import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ICandidate } from '@gauzy/contracts';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { Organization } from '../organization/organization.entity';

export const createDefaultCandidateCriterionRating = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization,
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
		const candidateInterviews = await connection.manager.find(
			CandidateInterview,
			{
				where: [{ candidate: defaultCandidate }]
			}
		);
		for (const interview of candidateInterviews) {
			const candidatesFeedback = await connection.manager.find(
				CandidateFeedback,
				{
					where: [{ candidate: defaultCandidate }]
				}
			);
			const candidatesPersonalQualities = await connection.manager.find(
				CandidatePersonalQualities,
				{
					where: [{ interview: interview }]
				}
			);
			const candidatesTechnologies = await connection.manager.find(
				CandidateTechnologies,
				{
					where: [{ interview: interview }]
				}
			);

			candidates = await dataOperation(
				connection,
				tenant,
				organization,
				candidates,
				candidatesFeedback,
				candidatesTechnologies,
				candidatesPersonalQualities
			);
		}
	}

	return candidates;
};

export const createRandomCandidateCriterionRating = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
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
			const candidateInterviews = await connection.manager.find(
				CandidateInterview,
				{
					where: [{ candidate: tenantCandidate }]
				}
			);

			for (const interview of candidateInterviews) {
				const candidatesFeedback = await connection.manager.find(
					CandidateFeedback,
					{
						where: [{ candidate: tenantCandidate }]
					}
				);
				const candidatesPersonalQualities = await connection.manager.find(
					CandidatePersonalQualities,
					{
						where: [{ interview: interview }]
					}
				);
				const candidatesTechnologies = await connection.manager.find(
					CandidateTechnologies,
					{
						where: [{ interview: interview }]
					}
				);

				candidates = await dataOperation(
					connection,
					tenant,
					interview.organization,
					candidates,
					candidatesFeedback,
					candidatesTechnologies,
					candidatesPersonalQualities
				);
			}
		}
	}
	return candidates;
};

const dataOperation = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization,
	candidates,
	candidatesFeedback,
	candidatesTechnologies,
	candidatesPersonalQualities
) => {
	for (const feedback of candidatesFeedback) {
		const candidate = new CandidateCriterionsRating();
		candidate.rating = Math.floor(Math.random() * 5) + 1;
		candidate.technologyId = candidatesTechnologies[0].id;
		candidate.personalQualityId = candidatesPersonalQualities[0].id;
		candidate.feedbackId = feedback.id;
		candidate.feedback = feedback;
		candidate.tenant = tenant;
		candidate.organization = organization;
		candidates.push(candidate);
	}
	await connection.manager.save(candidates);
	return candidates;
};
