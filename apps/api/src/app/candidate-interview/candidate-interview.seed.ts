import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateInterview } from './candidate-interview.entity';

export const createDefaultCandidateInterview = async (
  connection: Connection,
  tenant: Tenant,
  Candidates
): Promise<CandidateInterview[]> => {
  if (!Candidates) {
    console.warn(
      'Warning: Candidates not found, Default Candidate Interview will not be created'
    );
    return;
  }

  let candidates: CandidateInterview[] = [];

  for (const tenantCandidate of Candidates) {
    candidates = await dataOperation(connection,candidates,tenantCandidate, tenant);
  }

  return candidates;
};

export const createRandomCandidateInterview = async (
  connection: Connection,
  tenants: Tenant[],
  tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<CandidateInterview[]> => {
  if(!tenantCandidatesMap){
    console.warn(
      'Warning: tenantCandidatesMap not found, CandidateInterview will not be created'
    );
    return;
  }

  let candidates: CandidateInterview[] = [];

  for (const tenant of tenants) {
    let tenantCandidates = tenantCandidatesMap.get(tenant);
    for (const tenantCandidate of tenantCandidates) {
      candidates = await dataOperation(connection,candidates,tenantCandidate, tenant);
    }
  }
  return candidates;
};

const dataOperation = async (connection: Connection, candidates, tenantCandidate, tenant)=>{
  for (let i = 0; i <= (Math.floor(Math.random() * 3) + 1); i++) {
    let candidate = new CandidateInterview();

    var interViewDate = faker.date.past();

    candidate.title = faker.name.jobArea();
    candidate.startTime = new Date(interViewDate.setHours(10));
    candidate.endTime = new Date(interViewDate.setHours(12));
    candidate.location = faker.address.city();
    candidate.note = faker.lorem.words();
    candidate.candidate = tenantCandidate;
    candidate.tenant = tenant;

    candidates.push(candidate);
  }
  await connection.manager.save(candidates);
  return candidates;
}
