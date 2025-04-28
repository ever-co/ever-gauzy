import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { filter, uniq } from 'underscore';
import { lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { IOrganization, ITag, ITenant } from '@gauzy/contracts';
import {
	Organization,
	OrganizationProject,
	OrganizationTeam,
	Tag,
	Task,
	User,
	Employee,
	TaskProjectSequence
} from './../core/entities/internal';

// GITHUB API URL
export const GITHUB_API_URL = 'https://api.github.com';

export const createDefaultTask = async (dataSource: DataSource, tenant: ITenant, organization: IOrganization) => {
	const httpService = new HttpService();

	console.log(`${GITHUB_API_URL}/repos/ever-co/ever-gauzy/issues`);
	const issues$ = httpService
		.get(`${GITHUB_API_URL}/repos/ever-co/ever-gauzy/issues`)
		.pipe(map((response: AxiosResponse<any>) => response.data));
	const issues: any[] = await lastValueFrom(issues$);
	console.log(`Done ${GITHUB_API_URL}/repos/ever-co/ever-gauzy/issues`);

	let labels = [];
	issues.forEach(async (issue) => {
		labels = labels.concat(issue.labels);
	});

	labels = uniq(labels, (label) => label.name);
	const tags: ITag[] = await createTags(dataSource, labels, tenant, organization);

	const defaultProjects = await dataSource.manager.find(OrganizationProject);
	if (!defaultProjects) {
		console.warn('Warning: projects not found, DefaultTasks will not be created');
		return;
	}
	const teams = await dataSource.manager.find(OrganizationTeam);
	const users = await dataSource.manager.find(User);
	const employees = await dataSource.manager.find(Employee);

	let count = 0;
	for (const issue of issues) {
		const project = faker.helpers.arrayElement(defaultProjects);
		const taskNumber = await getTaskNumber(dataSource, project.id);

		const task = new Task();
		task.tags = filter(tags, (tag: ITag) => !!issue.labels.find((label: any) => label.name === tag.name));
		task.tenant = tenant;
		task.organization = organization;
		task.title = issue.title;
		task.description = issue.body;
		task.status = issue.state;
		task.estimate = null;
		task.isDraft = false;
		task.dueDate = faker.date.future({ years: 0.3 });
		task.project = project;
		task.prefix = project.name.substring(0, 3);
		task.number = taskNumber;
		task.creator = faker.helpers.arrayElement(users);

		if (count % 2 === 0) {
			task.members = faker.helpers.arrayElements(employees, 5);
		} else {
			task.teams = [faker.helpers.arrayElement(teams)];
		}
		await dataSource.manager.save(task);
		count++;
	}
};

export const createRandomTask = async (dataSource: DataSource, tenants: ITenant[]) => {
	const httpService = new HttpService();

	console.log(`${GITHUB_API_URL}/repos/ever-co/ever-gauzy/issues`);
	const issues$ = httpService
		.get(`${GITHUB_API_URL}/repos/ever-co/ever-gauzy/issues`)
		.pipe(map((response: AxiosResponse<any>) => response.data));
	const issues: any[] = await lastValueFrom(issues$);
	console.log(`Done ${GITHUB_API_URL}/repos/ever-co/ever-gauzy/issues`);

	let labels = [];
	issues.forEach(async (issue) => {
		labels = labels.concat(issue.labels);
	});

	labels = uniq(labels, (label) => label.name);

	for (const tenant of tenants || []) {
		const { id: tenantId } = tenant;
		const users = await dataSource.manager.find(User, {
			where: {
				tenantId
			}
		});
		const organizations = await dataSource.manager.find(Organization, {
			where: {
				tenantId
			}
		});
		for (const organization of organizations) {
			const { id: organizationId } = organization;
			const projects = await dataSource.manager.findBy(OrganizationProject, {
				tenantId,
				organizationId
			});
			if (!projects) {
				console.warn('Warning: projects not found, RandomTasks will not be created');
				continue;
			}
			const teams = await dataSource.manager.findBy(OrganizationTeam, {
				tenantId,
				organizationId
			});

			const tags: ITag[] = await createTags(dataSource, labels, tenant, organization);
			const employees = await dataSource.manager.findBy(Employee, {
				tenantId,
				organizationId
			});
			let count = 0;

			for (const issue of issues) {
				const project = faker.helpers.arrayElement(projects);
				const taskNumber = await getTaskNumber(dataSource, project.id);

				const task = new Task();
				task.tags = filter(tags, (tag: ITag) => !!issue.labels.find((label: any) => label.name === tag.name));
				task.title = issue.title;
				task.description = issue.body;
				task.status = issue.state;
				task.estimate = null;
				task.dueDate = null;
				task.isDraft = false;
				task.project = project;
				task.prefix = project.name.substring(0, 3);
				task.number = taskNumber;
				task.teams = [faker.helpers.arrayElement(teams)];
				task.creator = faker.helpers.arrayElement(users);
				task.organization = organization;
				task.tenant = tenant;

				if (count % 2 === 0) {
					task.members = faker.helpers.arrayElements(employees, 5);
				} else {
					task.teams = [faker.helpers.arrayElement(teams)];
				}

				await dataSource.manager.save(task);
				count++;
			}
		}
	}
};

export async function createTags(dataSource: DataSource, labels, tenant: ITenant, organization: IOrganization) {
	if (labels.length === 0) {
		return [];
	}

	const tags: ITag[] = labels.map(
		(label) =>
			new Tag({
				name: label.name,
				description: label.description,
				color: `#${label.color}`,
				tenant,
				organization
			})
	);

	const insertedTags = await dataSource.getRepository(Tag).save(tags);
	return insertedTags;
}

/**
 * GET task number by project
 *
 * @param dataSource
 * @param projectId
 * @returns
 */
export async function getTaskNumber(dataSource: DataSource, projectId: string): Promise<number> {
	const queryRunner = dataSource.createQueryRunner();
	await queryRunner.startTransaction();

	try {
		let projectTaskSequence = await queryRunner.manager.findOne(TaskProjectSequence, {
			where: { projectId },
			lock: { mode: 'pessimistic_write' }
		});
		let taskNumber = 1;

		if (!projectTaskSequence) {
			// If the current project task sequence doesn't exist, create a new one
			projectTaskSequence = queryRunner.manager.create(TaskProjectSequence, {
				projectId,
				taskNumber
			});
		} else {
			// If the current project task sequence exists, increment the task number
			projectTaskSequence.taskNumber += 1;
			taskNumber = projectTaskSequence.taskNumber;
		}

		// Save the project task sequence
		await queryRunner.manager.save(projectTaskSequence);
		await queryRunner.commitTransaction();

		return taskNumber;
	} catch (error) {
		await queryRunner.rollbackTransaction();
		throw error;
	} finally {
		await queryRunner.release();
	}
}
