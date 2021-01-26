import { Connection } from 'typeorm';
import * as faker from 'faker';
import * as _ from 'underscore';
import { HttpService } from '@nestjs/common';

import { TaskStatusEnum } from '@gauzy/contracts';
import { Task } from './task.entity';
import { Tag } from '../tags/tag.entity';
import { OrganizationProject } from '../organization-projects/organization-projects.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { User } from '../user/user.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

const GITHUB_API_URL = 'https://api.github.com';

export const createDefaultTask = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization
): Promise<Task[]> => {
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
	const tags: Tag[] = await createTags(connection, labels);

	const defaultProjects = await connection
		.getRepository(OrganizationProject)
		.createQueryBuilder()
		.getMany();

	// issues.forEach((issue) => {
	for (const issue of issues) {
		let status = TaskStatusEnum.TODO;
		if (issue.state === 'open') {
			status = TaskStatusEnum.IN_PROGRESS;
		}

		const project = faker.random.arrayElement(defaultProjects);
		const task = new Task();
		task.tags = _.filter(
			tags,
			(tag: Tag) =>
				!!issue.labels.find((label: any) => label.name === tag.name)
		);

		task.tenant = tenant;
		task.organization = organization;
		task.title = issue.title;
		task.description = issue.body;
		task.status = status;
		task.estimate = null;
		task.dueDate = null;
		task.project = project;
		task.teams = [faker.random.arrayElement(teams)];
		task.creator = faker.random.arrayElement(users);
		tasks.push(task);

		project.tasks = tasks;
		await connection.manager.save(project);
	}

	await connection.manager.save(tasks);
	return tasks;
};

export const createRandomTask = async (
	connection: Connection,
	tenants: Tenant[],
	projects: OrganizationProject[] | void
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
	const tags: Tag[] = await createTags(connection, labels);

	for await (const tenant of tenants || []) {
		const organizations = await connection.manager.find(Organization, {
			where: [{ tenant: tenant }]
		});
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
			(task.organization = faker.random.arrayElement(organizations)),
				(task.tenant = tenant);
			tasks.push(task);
		});
	}

	await connection.manager.save(tasks);
};

export async function createTags(connection: Connection, labels) {
	if (labels.length === 0) {
		return [];
	}

	const tags: Tag[] = labels.map(
		(label) =>
			new Tag({
				name: label.name,
				description: label.description,
				color: label.color
			})
	);

	const insertedTags = await connection.getRepository(Tag).save(tags);
	return insertedTags;
}
