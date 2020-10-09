import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ICandidate } from '@gauzy/models';
import * as faker from 'faker';
import { CandidateExperience } from './candidate-experience.entity';
import { Organization } from '../organization/organization.entity';

export const createRandomCandidateExperience = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
): Promise<CandidateExperience[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateExperience will not be created'
		);
		return;
	}

	const candidates: CandidateExperience[] = [];

	for (const tenant of tenants) {
		const tenantCandidates = tenantCandidatesMap.get(tenant);
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
		for (const tenantCandidate of tenantCandidates) {
			for (let i = 0; i <= Math.floor(Math.random() * 3) + 1; i++) {
				const candidate = new CandidateExperience();
				let getExperience =
					(faker.date.past().getDate() -
						faker.date.past().getDate()) /
						30 +
					faker.date.past().getMonth() -
					faker.date.past().getMonth() +
					12 *
						(faker.date.past().getFullYear() -
							faker.date.past().getFullYear());
				getExperience = Number(getExperience.toFixed(2));
				const val = Math.abs(getExperience);
				candidate.occupation = faker.name.jobArea();
				candidate.organization = faker.random.arrayElement(
					organizations
				);
				candidate.duration =
					val.toString().split('.')[0].toString() + ' months';
				candidate.description = faker.lorem.words();
				candidate.candidateId = tenantCandidate.id;
				candidate.candidate = tenantCandidate;
				candidate.tenant = tenant;
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
