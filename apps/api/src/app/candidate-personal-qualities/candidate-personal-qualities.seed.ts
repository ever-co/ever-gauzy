import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

export const createRandomCandidatePersonalQualities = async (
  connection: Connection,
  tenants: Tenant[],
  tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<CandidatePersonalQualities[]> => {
  if(!tenantCandidatesMap){
    console.warn(
      'Warning: tenantCandidatesMap not found, CandidatePersonalQualities will not be created'
    );
    return;
  }

  let candidates: CandidatePersonalQualities[] = [];
  for (const tenant of tenants) {
    let tenantCandidates = tenantCandidatesMap.get(tenant);
    for (const tenantCandidate of tenantCandidates) {

      const CandidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });
      for (let interview of CandidateInterviews) {
        let candidate = new CandidatePersonalQualities();

        candidate.name = faker.name.jobArea();
        candidate.interviewId = interview.id;
        candidate.rating = (Math.floor(Math.random() * 5) + 1);
        candidate.interview = interview;

        candidates.push(candidate);
      }
    }
  }
  await insertRandomCandidatePersonalQualities(connection, candidates);
  return candidates;
};

const insertRandomCandidatePersonalQualities = async (
  connection: Connection,
  Candidates: CandidatePersonalQualities[]
) => {
  await connection
    .createQueryBuilder()
    .insert()
    .into(CandidatePersonalQualities)
    .values(Candidates)
    .execute();
};
