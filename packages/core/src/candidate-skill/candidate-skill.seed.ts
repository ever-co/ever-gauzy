import { ISkill, ICandidate, IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import * as faker from 'faker';
import { CandidateSkill } from './candidate-skill.entity';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_CANDIDATE_SKILLS } from './default-candidate-skills';

export const createCandidateSkills = async (
	connection: Connection,
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
	await insertCandidateSkills(connection, defaultCandidateSkills);
	return defaultCandidateSkills;
};

export const createRandomCandidateSkills = async (
	connection: Connection,
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
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
		const candidates = tenantCandidatesMap.get(tenant);
		for (const candidate of candidates) {
			const skills = DEFAULT_CANDIDATE_SKILLS.map((skill) => ({
				name: skill.name,
				candidateId: candidate.id,
				organization: faker.random.arrayElement(organizations),
				tenant: tenant
			}));
			candidateSkillsMap.set(candidate, skills);
			candidateSkills = [...candidateSkills, ...skills];
		}
	}
	await insertCandidateSkills(connection, candidateSkills);
	return candidateSkillsMap;
};

const insertCandidateSkills = async (
	connection: Connection,
	candidateSkills: CandidateSkill[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateSkill)
		.values(candidateSkills)
		.execute();
};
