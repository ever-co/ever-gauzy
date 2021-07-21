import { Connection } from 'typeorm';
import * as faker from 'faker';
import * as _ from 'underscore';
import { HttpService } from '@nestjs/common';
import { IOrganization, IOrganizationProject, ITag, ITask, ITenant, TaskStatusEnum } from '@gauzy/contracts';
import { Organization, OrganizationProject, OrganizationTeam, Tag, Task, User } from './../core/entities/internal';

const GITHUB_API_URL = 'https://api.github.com';

export const createDefaultTask = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
): Promise<ITask[]> => {
	const httpService = new HttpService();
	const tasks: ITask[] = [];

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
	const tags: ITag[] = await createTags(connection, labels);

	const defaultProjects = await connection.manager.find(OrganizationProject);
	const teams = await connection.manager.find(OrganizationTeam);
	const users = await connection.manager.find(User);

	console.log(issues.length);

	for (const issue of issues) {
		let status = TaskStatusEnum.TODO;
		if (issue.state === 'open') {
			status = TaskStatusEnum.IN_PROGRESS;
		}
		const project = faker.random.arrayElement(defaultProjects);
		const task = new Task();
		task.tags = _.filter(tags, (tag: ITag) => !!issue.labels.find((label: any) => label.name === tag.name));
		task.tenant = tenant;
		task.organization = organization;
		task.title = issue.title;
		task.description = issue.body;
		task.status = status;
		task.estimate = null;
		task.dueDate = faker.date.future(0.3);
		task.project = project;
		task.teams = [faker.random.arrayElement(teams)];
		task.creator = faker.random.arrayElement(users);
		tasks.push(task);
	}

	await connection.manager.save(tasks);
	return tasks;
};

export const createRandomTask = async (
	connection: Connection,
	tenants: ITenant[],
	projects: IOrganizationProject[] | void
) => {
	if (!projects) {
		console.warn(
			'Warning: projects not found, RandomTask will not be created'
		);
		return;
	}

	const httpService = new HttpService();
	const tasks: ITask[] = [];

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
	const tags: ITag[] = await createTags(connection, labels);

	for await (const tenant of tenants || []) {
		const teams = await connection.manager.find(OrganizationTeam, {
			where: {
				tenant
			}
		});
		const organizations = await connection.manager.find(Organization, {
			where: {
				tenant
			}
		});
		const users = await connection.manager.find(User, {
			where: {
				tenant
			}
		});
		issues.forEach((issue) => {
			let status = TaskStatusEnum.TODO;
			if (issue.state === 'open') {
				status = TaskStatusEnum.IN_PROGRESS;
			}

			const task = new Task();
			task.tags = _.filter(tags, (tag: ITag) => !!issue.labels.find((label: any) => label.name === tag.name));
			task.title = issue.title;
			task.description = issue.body;
			task.status = status;
			task.estimate = null;
			task.dueDate = null;
			task.project = faker.random.arrayElement(projects);
			task.teams = [faker.random.arrayElement(teams)];
			task.creator = faker.random.arrayElement(users);
			task.organization = faker.random.arrayElement(organizations),
			task.tenant = tenant;
			tasks.push(task);
		});
	}

	await connection.manager.save(tasks);
};

export async function createTags(connection: Connection, labels) {
	if (labels.length === 0) {
		return [];
	}

	const tags: ITag[] = labels.map(
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
