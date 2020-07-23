import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

export const createRandomCandidateTechnologies = async (
  connection: Connection,
  tenants: Tenant[],
  tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<CandidateTechnologies[]> => {

  if(!tenantCandidatesMap){
    console.warn(
      'Warning: tenantCandidatesMap not found, CandidateFeedbacks will not be created'
    );
    return;
  }

  let candidates: CandidateTechnologies[] = [];
  for (const tenant of tenants) {
    let tenantCandidates = tenantCandidatesMap.get(tenant);
    for (const tenantCandidate of tenantCandidates) {

      const CandidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });
      for (let interview of CandidateInterviews) {
        let candidate = new CandidateTechnologies();

        candidate.name = faker.name.jobArea();
        candidate.interviewId = interview.id;
        candidate.rating = (Math.floor(Math.random() * 5) + 1);
        candidate.interview = interview;

        candidates.push(candidate);
      }
    }
  }
  await insertRandomCandidateTechnologies(connection, candidates);
  return candidates;
};

const insertRandomCandidateTechnologies = async (
  connection: Connection,
  Candidates: CandidateTechnologies[]
) => {
  await connection
    .createQueryBuilder()
    .insert()
    .into(CandidateTechnologies)
    .values(Candidates)
    .execute();
};
