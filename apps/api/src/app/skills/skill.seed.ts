import { IOrganization, ITenant } from '@gauzy/models';
import { Connection } from 'typeorm';
import { DEFAULT_SKILLS } from './default-skills';
import { Skill } from './skill.entity';

export const createDefaultSkills = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
): Promise<Skill[]> => {
	const skills: Skill[] = [];
	for (const name of DEFAULT_SKILLS) {
		const skill = new Skill();
		skill.name = name;
		skill.tenant = tenant;
		skill.organization = organization;
		skill.description = '';
		skill.color = '#479bfa';
		skills.push(skill);
	}

	return await connection.manager.save(skills);
};
