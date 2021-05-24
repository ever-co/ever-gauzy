import { IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import * as faker from 'faker';
import { DEFAULT_SKILLS } from './default-skills';
import { Skill } from './skill.entity';

export const createDefaultSkills = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
): Promise<Skill[]> => {
	try {
		const skills: Skill[] = [];
		for (const name of DEFAULT_SKILLS) {
			const skill = new Skill();
			skill.name = name;
			skill.tenant = tenant;
			skill.organization = organization;
			skill.description = '';
			skill.color = faker.internet.color();
			skills.push(skill);
		}
		return await connection.manager.save(skills);
	} catch (error) {
		console.log({error})
	}
};
