import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate, Employee } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';

export const createDefaultCandidateInterviewers = async (
  connection: Connection,
  tenant: Tenant,
  defaultEmployees,
  defaultCandidates
): Promise<CandidateInterviewers[]> => {

  if(!defaultEmployees){
    console.warn(
      'Warning: defaultEmployees not found, Default CandidateInterviewers will not be created'
    );
    return;
  }
  if(!defaultCandidates){
    console.warn(
      'Warning: defaultCandidates not found, Default Candidate Interviewers will not be created'
    );
    return;
  }

  let candidates: CandidateInterviewers[] = [];

  for (const defaultCandidate of defaultCandidates) {

      const CandidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: defaultCandidate }]
      });
    candidates = await dataOperation(connection, candidates, CandidateInterviews, defaultEmployees, tenant);

    }
  return candidates;
};

export const createRandomCandidateInterviewers = async (
  connection: Connection,
  tenants: Tenant[],
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<CandidateInterviewers[]> => {

  if(!tenantCandidatesMap){
    console.warn(
      'Warning: tenantCandidatesMap not found, CandidateInterviewers will not be created'
    );
    return;
  }

  let candidates: CandidateInterviewers[] = [];

  for (const tenant of tenants) {
    let tenantCandidates = tenantCandidatesMap.get(tenant);
    let tenantEmployees = tenantEmployeeMap.get(tenant);

    for (const tenantCandidate of tenantCandidates) {

      const CandidateInterviews = await connection.manager.find(CandidateInterview, {
        where: [{ candidate: tenantCandidate }]
      });
      candidates = await dataOperation(connection, candidates, CandidateInterviews, tenantEmployees, tenant);
    }
  }
  return candidates;
};


const dataOperation = async (connection: Connection, candidates, CandidateInterviews, tenantEmployees: Employee[], tenant)=>{
  for (let interview of CandidateInterviews) {

    let candidate = new CandidateInterviewers();

    candidate.interviewId = interview.id;
    candidate.interview = interview;
    candidate.employeeId = faker.random.arrayElement(tenantEmployees).id;
    candidate.tenant = tenant;

    candidates.push(candidate);
  }
  await connection.manager.save(candidates);
  return candidates;
}
