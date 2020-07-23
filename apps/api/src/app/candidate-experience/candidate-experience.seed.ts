import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateExperience } from './candidate-experience.entity';

export const createRandomCandidateExperience = async (
  connection: Connection,
  tenants: Tenant[],
  tenantCandidatesMap: Map<Tenant, Candidate[]>
): Promise<CandidateExperience[]> => {

  let candidates: CandidateExperience[] = [];

  for (const tenant of tenants) {
    let tenantCandidates = tenantCandidatesMap.get(tenant);
    for (const tenantCandidate of tenantCandidates) {
      for (let i = 0; i <= (Math.floor(Math.random() * 3) + 1); i++) {
        let candidate = new CandidateExperience();
        var getExperience = (faker.date.past().getDate() - faker.date.past().getDate()) / 30 +
          faker.date.past().getMonth() - faker.date.past().getMonth() +
          (12 * (faker.date.past().getFullYear() - faker.date.past().getFullYear()));
        getExperience = Number(getExperience.toFixed(2));
        let val = Math.abs(getExperience);
        candidate.occupation = faker.name.jobArea();
        candidate.organization = faker.company.companyName();
        candidate.duration = val.toString().split('.')[0].toString() + ' months';
        candidate.description = faker.lorem.words();
        candidate.candidateId = tenantCandidate.id;
        candidate.candidate = tenantCandidate;
        candidates.push(candidate);
      }
    }
  }
  await insertRandomCandidateExperience(connection, candidates);
  return candidates;
};

const insertRandomCandidateExperience = async (
  connection: Connection,
  Candidates: CandidateExperience[]
) => {
  await connection
    .createQueryBuilder()
    .insert()
    .into(CandidateExperience)
    .values(Candidates)
    .execute();
};
