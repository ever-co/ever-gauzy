import { ISkill, Candidate } from '@gauzy/models';
import { Connection } from 'typeorm';
import { CandidateSkill } from './candidate-skill.entity';
import { Tenant } from '../tenant/tenant.entity';

const createCandiateSkills: ISkill[] = [
	{
		name: 'Fullstack Developer'
	}
];

export const createCandidateSkills = async (
	connection: Connection,
	candidates: Candidate[] | void
): Promise<CandidateSkill[]> => {
	let defaultCandidateSkills = [];

	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateSkills will not be created'
		);
		return;
	}

	candidates.forEach((candidate) => {
		const skills = createCandiateSkills.map((skill) => ({
			name: skill.name,

			candidateId: candidate.id
		}));
		defaultCandidateSkills = [...defaultCandidateSkills, ...skills];
	});

	insertCandidateSkills(connection, defaultCandidateSkills);

	return defaultCandidateSkills;
};

export const createRandomCandidateSkills = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<Map<Candidate, CandidateSkill[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateSkills will not be created'
		);
		return;
	}

	let candidateSkills = [];
	const candidateSkillsMap: Map<Candidate, any[]> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const skills = candidateSkills.map((skill) => ({
				name: skill.name,
				candidateId: candidate.id
			}));

			candidateSkillsMap.set(candidate, skills);
			candidateSkills = [...candidateSkills, ...skills];
		});
	});

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
