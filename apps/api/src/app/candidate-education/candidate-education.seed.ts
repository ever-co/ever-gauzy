import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '../candidate/candidate.entity';
import { CandidateEducation } from './candidate-education.entity';
import * as faker from 'faker';

export const createRandomCandidateEducations = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<CandidateEducation[]> => {
	let candidates: CandidateEducation[] = [];
	let degrees = ['Bachelor', 'Master', 'PhD'];

	for (const tenant of tenants) {
		let tenantCandidates = await connection.manager.find(Candidate, {
			where: [{ tenant: tenant }]
		});
		for (const tenantCandidate of tenantCandidates) {
			for (let name of degrees) {
				let candidate = new CandidateEducation();
				candidate.schoolName = faker.company.companyName();
				candidate.degree = name;
				candidate.field = faker.name.jobArea();
				candidate.completionDate = faker.date.past();
				candidate.candidateId = tenantCandidate.id;
				candidate.candidate = tenantCandidate;
				candidates.push(candidate);
			}
		}
	}
	await insertCandidateEducation(connection, candidates);

	return candidates;
};

const insertCandidateEducation = async (
	connection: Connection,
	CandidateEducations: CandidateEducation[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateEducation)
		.values(CandidateEducations)
		.execute();
};
