import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

export const createDefaultCandidatePersonalQualities = async (
  connection: Connection,
  defaultCandidates
): Promise<CandidatePersonalQualities[]> => {
  if(!defaultCandidates){
    console.warn(
      'Warning: defaultCandidates not found, default Candidate Personal Qualities will not be created'
    );
    return;
  }

  let candidates: CandidatePersonalQualities[] = [];
    for (const tenantCandidate of defaultCandidates) {

      const candidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });
      candidates = await dataOperation(connection, candidates, candidateInterviews,);
  }
  return candidates;
};

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

      const candidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });
      candidates = await dataOperation(connection, candidates, candidateInterviews);
    }
  }
  return candidates;
};

const dataOperation = async (connection: Connection, candidates, CandidateInterviews)=>{
  for (let interview of CandidateInterviews) {
    let candidate = new CandidatePersonalQualities();

    candidate.name = faker.name.jobArea();
    candidate.interviewId = interview.id;
    candidate.rating = (Math.floor(Math.random() * 5) + 1);
    candidate.interview = interview;

    candidates.push(candidate);
  }
  await connection.manager.save(candidates);
  return candidates;
}
