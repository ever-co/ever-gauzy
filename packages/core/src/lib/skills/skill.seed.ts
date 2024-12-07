import { IOrganization, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { DEFAULT_SKILLS } from './default-skills';
import { Skill } from './skill.entity';

export const createDefaultSkills = async (
	dataSource: DataSource,
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
		return await dataSource.manager.save(skills);
	} catch (error) {
		console.log({ error })
	}
};
