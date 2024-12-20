import { ISkill, ICandidate, IOrganization, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { CandidateSkill } from './candidate-skill.entity';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_CANDIDATE_SKILLS } from './default-candidate-skills';

export const createCandidateSkills = async (
	dataSource: DataSource,
	tenant: ITenant,
	candidates: ICandidate[] | void,
	organization: IOrganization
): Promise<CandidateSkill[]> => {
	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateSkills will not be created'
		);
		return;
	}
	let defaultCandidateSkills = [];
	for (const candidate of candidates) {
		const skills = DEFAULT_CANDIDATE_SKILLS.map((skill: ISkill) => ({
			name: skill.name,
			candidateId: candidate.id,
			...{ organization, tenant }
		}));
		defaultCandidateSkills = [...defaultCandidateSkills, ...skills];
	}
	await insertCandidateSkills(dataSource, defaultCandidateSkills);
	return defaultCandidateSkills;
};

export const createRandomCandidateSkills = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<Map<ICandidate, CandidateSkill[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateSkills will not be created'
		);
		return;
	}

	let candidateSkills = [];
	const candidateSkillsMap: Map<ICandidate, any[]> = new Map();
	for await (const tenant of tenants || []) {
		const { id: tenantId } = tenant;
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId
		});
		const candidates = tenantCandidatesMap.get(tenant);
		for (const candidate of candidates) {
			const skills = DEFAULT_CANDIDATE_SKILLS.map((skill) => ({
				name: skill.name,
				candidateId: candidate.id,
				organization: faker.helpers.arrayElement(organizations),
				tenant: tenant
			}));
			candidateSkillsMap.set(candidate, skills);
			candidateSkills = [...candidateSkills, ...skills];
		}
	}
	await insertCandidateSkills(dataSource, candidateSkills);
	return candidateSkillsMap;
};

const insertCandidateSkills = async (
	dataSource: DataSource,
	candidateSkills: CandidateSkill[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(CandidateSkill)
		.values(candidateSkills)
		.execute();
};
