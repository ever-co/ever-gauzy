import { Connection } from 'typeorm';
import * as faker from 'faker';
import * as _ from 'underscore';
import { HttpService } from '@nestjs/common';

import { TaskStatusEnum } from '@gauzy/models';
import { Task } from './task.entity';
import { Tag } from '../tags/tag.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { User } from '../user/user.entity';

const GITHUB_API_URL = 'https://api.github.com';

export const createRandomTask = async (
	connection: Connection,
	projects: OrganizationProjects[] | void
) => {
	if (!projects) {
		console.warn(
			'Warning: projects not found, RandomTask will not be created'
		);
		return;
	}

	const httpService = new HttpService();

	const tasks: Task[] = [];

	const teams = await connection
		.getRepository(OrganizationTeam)
		.createQueryBuilder()
		.getMany();

	const users = await connection
		.getRepository(User)
		.createQueryBuilder()
		.getMany();

	console.log(`${GITHUB_API_URL}/repos/ever-co/gauzy/issues`);
	const issues: any[] = await httpService
		.get(`${GITHUB_API_URL}/repos/ever-co/gauzy/issues`)
		.toPromise()
		.then((resp) => resp.data);

	console.log(`Done ${GITHUB_API_URL}/repos/ever-co/gauzy/issues`);

	let labels = [];
	issues.forEach(async (issue) => {
		labels = labels.concat(issue.labels);
	});

	labels = _.uniq(labels, (label) => label.name);
	const tags: Tag[] = await findOrCreateTags(connection, labels);

	issues.forEach((issue) => {
		let status = TaskStatusEnum.TODO;
		if (issue.state === 'open') {
			status = TaskStatusEnum.IN_PROGRESS;
		}

		const task = new Task();

		task.tags = _.filter(
			tags,
			(tag: Tag) =>
				!!issue.labels.find((label: any) => label.name === tag.name)
		);

		task.title = issue.title;
		task.description = issue.body;
		task.status = status;
		task.estimate = null;
		task.dueDate = null;
		task.project = faker.random.arrayElement(projects);
		task.teams = [faker.random.arrayElement(teams)];
		task.creator = faker.random.arrayElement(users);

		tasks.push(task);
	});
	await connection.manager.save(tasks);
};

export async function findOrCreateTags(connection: Connection, labels) {
	if (labels.length === 0) {
		return [];
	}
	const tags: Tag[] = labels.map((label) => ({
		name: label.name,
		description: label.description,
		color: label.color
		// organization
		// tenant
	}));
	await connection
		.getRepository(Tag)
		.createQueryBuilder()
		.insert()
		.values(tags)
		.onConflict('("name") DO NOTHING')
		.returning('*')
		.execute();

	const insertedTags = await connection
		.getRepository(Tag)
		.createQueryBuilder()
		.getMany();
	return insertedTags;
}
