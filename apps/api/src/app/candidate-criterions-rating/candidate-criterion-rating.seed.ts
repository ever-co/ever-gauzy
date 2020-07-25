import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';
import * as _ from 'underscore';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

export const createRandomCandidateCriterionRating = async (
  connection: Connection,
  tenants: Tenant[],
  tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<CandidateCriterionsRating[]> => {

  if(!tenantCandidatesMap){
    console.warn(
      'Warning: tenantCandidatesMap not found, Criterion rating  will not be created'
    );
    return;
  }

  let candidates: CandidateCriterionsRating[] = [];

  for (const tenant of tenants) {
    let tenantCandidates = tenantCandidatesMap.get(tenant);
    for (const tenantCandidate of tenantCandidates) {

      const CandidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });

      for (let interview of CandidateInterviews) {
        const CandidatesFeedback = await connection.manager.find(CandidateFeedback, {
          where: [{ candidate: tenantCandidate }]
        });
        const CandidatesPersonalQualities = await connection.manager.find(CandidatePersonalQualities, {
          where: [{ interview: interview }]
        });
        const CandidatesTechnologies = await connection.manager.find(CandidateTechnologies, {
          where: [{ interview: interview }]
        });

        for (let feedback of CandidatesFeedback) {
          let candidate = new CandidateCriterionsRating();

          candidate.rating = (Math.floor(Math.random() * 5) + 1);
          candidate.technologyId = CandidatesTechnologies[0].id; // null
          candidate.personalQualityId = CandidatesPersonalQualities[0].id; // null
          candidate.feedbackId = feedback.id; // null
          candidate.feedback = feedback;
          candidates.push(candidate);
        }
      }
    }
  }
  await insertRandomCandidateCriterionRating(connection, candidates);
  return candidates;
};

const insertRandomCandidateCriterionRating = async (
  connection: Connection,
  Candidates: CandidateCriterionsRating[]
) => {
  await connection
    .createQueryBuilder()
    .insert()
    .into(CandidateCriterionsRating)
    .values(Candidates)
    .execute();
};
