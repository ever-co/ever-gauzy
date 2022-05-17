import { Connection } from 'typeorm';
import { faker } from '@ever-co/faker';
import * as _ from 'underscore';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import {
	IOrganization,
	ITag,
	ITask,
	ITenant,
	TaskStatusEnum
} from '@gauzy/contracts';
import {
	Organization,
	OrganizationProject,
	OrganizationTeam,
	Tag,
	Task,
	User,
	Employee 
} from './../core/entities/internal';
import { lastValueFrom, map } from 'rxjs';

const GITHUB_API_URL = 'https://api.github.com';

export const createDefaultTask = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
): Promise<ITask[]> => {
	const httpService = new HttpService();
	const tasks: ITask[] = [];

	console.log(`${GITHUB_API_URL}/repos/ever-co/gauzy/issues`);
	const issues$ = httpService
			.get(`${GITHUB_API_URL}/repos/ever-co/gauzy/issues`)
			.pipe(
				map(
					(response: AxiosResponse<any>) => response.data
				)
			);
	const issues: any[] = await lastValueFrom(issues$);
	console.log(`Done ${GITHUB_API_URL}/repos/ever-co/gauzy/issues`);

	let labels = [];
	issues.forEach(async (issue) => { labels = labels.concat(issue.labels); });

	labels = _.uniq(labels, (label) => label.name);
	const tags: ITag[] = await createTags(
		connection,
		labels,
		tenant,
		organization
	);

	const defaultProjects = await connection.manager.find(OrganizationProject, {
		where: {
			organization,
			tenant
		}
	});
	if (!defaultProjects) {
		console.warn(
			'Warning: projects not found, DefaultTasks will not be created'
		);
		return;
	}
	const teams = await connection.manager.find(OrganizationTeam);
	const users = await connection.manager.find(User);
	const employees = await connection.manager.find(Employee);

	let count = 0;
	for await (const issue of issues) {
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
		task.prefix = project.name.substring(0, 3);
		task.creator = faker.random.arrayElement(users);

		if (count % 2 === 0) {
			task.members = faker.random.arrayElements(employees, 5);
		} else {
			task.teams = [faker.random.arrayElement(teams)];
		}
		await connection.manager.save(task);

		tasks.push(task);
		count++;
	}
	return tasks;
};

export const createRandomTask = async (
	connection: Connection,
	tenants: ITenant[]
) => {
	const httpService = new HttpService();
	const tasks: ITask[] = [];

	console.log(`${GITHUB_API_URL}/repos/ever-co/gauzy/issues`);
	const issues$ = httpService
			.get(`${GITHUB_API_URL}/repos/ever-co/gauzy/issues`)
			.pipe(
				map(
					(response: AxiosResponse<any>) => response.data
				)
			);
	const issues: any[] = await lastValueFrom(issues$);
	console.log(`Done ${GITHUB_API_URL}/repos/ever-co/gauzy/issues`);

	let labels = [];
	issues.forEach(async (issue) => { labels = labels.concat(issue.labels); });

	labels = _.uniq(labels, (label) => label.name);

	for await (const tenant of tenants || []) {
		const projects = await connection.manager.find(OrganizationProject, {
			where: {
				tenant
			}
		});
		if (!projects) {
			console.warn(
				'Warning: projects not found, RandomTasks will not be created'
			);
			continue;
		}
		const teams = await connection.manager.find(OrganizationTeam, {
			where: {
				tenant
			}
		});
		const users = await connection.manager.find(User, {
			where: {
				tenant
			}
		});
		const organizations = await connection.manager.find(Organization, {
			where: {
				tenant
			}
		});
		for await (const organization of organizations) {
			const tags: ITag[] = await createTags(
				connection,
				labels,
				tenant,
				organization
			);
			const employees = await connection.manager.find(Employee, {
				tenant,
				organization
			});
			let count = 0;

			for await (const issue of issues) {
				let status = TaskStatusEnum.TODO;
				if (issue.state === 'open') {
					status = TaskStatusEnum.IN_PROGRESS;
				}

				const project = faker.random.arrayElement(projects);

				const task = new Task();
				task.tags = _.filter(tags, (tag: ITag) => !!issue.labels.find((label: any) => label.name === tag.name));
				task.title = issue.title;
				task.description = issue.body;
				task.status = status;
				task.estimate = null;
				task.dueDate = null;
				task.project = project;
				task.prefix = project.name.substring(0, 3);
				task.teams = [faker.random.arrayElement(teams)];
				task.creator = faker.random.arrayElement(users);
				task.organization = organization,
				task.tenant = tenant;

				if (count % 2 === 0) {
					task.members = faker.random.arrayElements(employees, 5);
				} else {
					task.teams = [faker.random.arrayElement(teams)];
				}

				await connection.manager.save(task);

				tasks.push(task);
				count++;
			}
		}
	}

};

export async function createTags(
	connection: Connection,
	labels,
	tenant: ITenant,
	organization: IOrganization
) {
	if (labels.length === 0) {
		return [];
	}

	const tags: ITag[] = labels.map(
		(label) =>
			new Tag({
				name: label.name,
				description: label.description,
				color: label.color,
				tenant,
				organization
			})
	);

	const insertedTags = await connection.getRepository(Tag).save(tags);
	return insertedTags;
}
