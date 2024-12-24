import { DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ICandidate } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { CandidateExperience } from './candidate-experience.entity';
import { Organization } from '../organization/organization.entity';

export const createRandomCandidateExperience = async (
	dataSource: DataSource,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
): Promise<CandidateExperience[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateExperience will not be created'
		);
		return;
	}

	const candidateExperiences: CandidateExperience[] = [];

	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const tenantCandidates = tenantCandidatesMap.get(tenant);
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		for (const tenantCandidate of tenantCandidates) {
			for (let i = 0; i <= Math.floor(Math.random() * 3) + 1; i++) {
				const candidateExperience = new CandidateExperience();
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
				candidateExperience.occupation = faker.person.jobArea();
				candidateExperience.organization = faker.helpers.arrayElement(
					organizations
				);
				candidateExperience.duration =
					val.toString().split('.')[0].toString() + ' months';
				candidateExperience.description = faker.lorem.words();
				candidateExperience.candidateId = tenantCandidate.id;
				candidateExperience.candidate = tenantCandidate;
				candidateExperience.tenant = tenant;
				candidateExperiences.push(candidateExperience);
			}
		}
	}
	return await insertRandomCandidateExperience(
		dataSource,
		candidateExperiences
	);
};

const insertRandomCandidateExperience = async (
	dataSource: DataSource,
	candidateExperiences: CandidateExperience[]
): Promise<CandidateExperience[]> => {
	return await dataSource.manager.save(candidateExperiences);
};
