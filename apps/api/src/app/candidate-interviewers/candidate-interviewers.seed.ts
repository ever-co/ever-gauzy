import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate, Employee } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import * as _ from 'underscore';

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
      for (let interview of CandidateInterviews) {
        const employee = _.chain(tenantEmployees)
          .shuffle()
          .take(faker.random.number({ min: 1, max: 1 }))
          .values()
          .value();

        let candidate = new CandidateInterviewers();

        candidate.interviewId = interview.id;
        candidate.interview = interview;
        candidate.employeeId = employee[0].id;

        candidates.push(candidate);
      }
    }
  }
  await insertRandomCandidateInterviewers(connection, candidates);
  return candidates;
};

const insertRandomCandidateInterviewers = async (
  connection: Connection,
  Candidates: CandidateInterviewers[]
) => {
  await connection
    .createQueryBuilder()
    .insert()
    .into(CandidateInterviewers)
    .values(Candidates)
    .execute();
};
