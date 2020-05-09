import { Connection } from 'typeorm';
import { Skill } from './skill.entity';

export const createSkills = async (
	connection: Connection
): Promise<Skill[]> => {
	const skills: Skill[] = [];
	const skillNames = [
		'Node.js',
		'Angular',
		'React',
		'NestJS',
		'NextJS',
		'PostgreSQL'
	];

	for (const name of skillNames) {
		const skill = new Skill();
		skill.name = name;
		skill.description = '';
		skill.color = '#479bfa';
		skills.push(skill);
	}

	await connection
		.createQueryBuilder()
		.insert()
		.into(Skill)
		.values(skills)
		.execute();

	return skills;
};
