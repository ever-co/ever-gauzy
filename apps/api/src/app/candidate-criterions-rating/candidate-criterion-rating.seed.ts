import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

export const createDefaultCandidateCriterionRating = async (
  connection: Connection,
  defaultCandidates
): Promise<CandidateCriterionsRating[]> => {

  if(!defaultCandidates){
    console.warn(
      'Warning: defaultCandidates not found, default Criterion rating  will not be created'
    );
    return;
  }

  let candidates: CandidateCriterionsRating[] = [];

  for (const defaultCandidate of defaultCandidates) {

      const CandidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: defaultCandidate }]
      });
      for (let interview of CandidateInterviews) {
        const CandidatesFeedback = await connection.manager.find(CandidateFeedback, {
          where: [{ candidate: defaultCandidate }]
        });
        const candidatesPersonalQualities = await connection.manager.find(CandidatePersonalQualities, {
          where: [{ interview: interview }]
        });
        const candidatesTechnologies = await connection.manager.find(CandidateTechnologies, {
          where: [{ interview: interview }]
        });

        candidates = await dataOperation(connection, candidates, CandidatesFeedback, candidatesTechnologies,candidatesPersonalQualities);
      }
    }

  return candidates;
};

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
        const candidatesPersonalQualities = await connection.manager.find(CandidatePersonalQualities, {
          where: [{ interview: interview }]
        });
        const candidatesTechnologies = await connection.manager.find(CandidateTechnologies, {
          where: [{ interview: interview }]
        });

        candidates = await dataOperation(connection, candidates, CandidatesFeedback, candidatesTechnologies,candidatesPersonalQualities);
      }
    }
  }
  return candidates;
};

const dataOperation = async (connection: Connection, candidates, CandidatesFeedback, CandidatesTechnologies, CandidatesPersonalQualities)=>{
  for (let feedback of CandidatesFeedback) {
    let candidate = new CandidateCriterionsRating();

    candidate.rating = (Math.floor(Math.random() * 5) + 1);
    candidate.technologyId = CandidatesTechnologies[0].id;
    candidate.personalQualityId = CandidatesPersonalQualities[0].id;
    candidate.feedbackId = feedback.id;
    candidate.feedback = feedback;
    candidates.push(candidate);
  }
  await connection.manager.save(candidates);
  return candidates;
}
