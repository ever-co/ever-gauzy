import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateTechnologies } from './candidate-technologies.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
export const createDefaultCandidateTechnologies = async (
  connection: Connection,
  tenant: Tenant,
  defaultCandidates
): Promise<CandidateTechnologies[]> => {

  if(!defaultCandidates){
    console.warn(
      'Warning: defaultCandidates not found, Default Candidate Feedbacks will not be created'
    );
    return;
  }

  let candidates: CandidateTechnologies[] = [];
    for (const tenantCandidate of defaultCandidates) {

      const candidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });
      candidates = await dataOperation(connection,candidates,candidateInterviews, tenant)
    }

  return candidates;
};

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

      const candidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });
      candidates = await dataOperation(connection,candidates,candidateInterviews, tenant)
    }
  }
  return candidates;
};

const dataOperation = async (connection: Connection, candidates, CandidateInterviews, tenant)=>{
  for (let interview of CandidateInterviews) {
    let candidate = new CandidateTechnologies();

    candidate.name = faker.name.jobArea();
    candidate.interviewId = interview.id;
    candidate.rating = (Math.floor(Math.random() * 5) + 1);
    candidate.interview = interview;
    candidate.tenant = tenant;

    candidates.push(candidate);
  }
  await connection.manager.save(candidates);
  return candidates;
}
