import { Brackets, Connection, WhereExpressionBuilder } from 'typeorm';
import { faker } from '@ever-co/faker';
import { filter, uniq } from 'underscore';
import { lastValueFrom, map } from 'rxjs';
import { isNotEmpty } from '@gauzy/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import {
	IGetTaskOptions,
	IOrganization,
	ITag,
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

const GITHUB_API_URL = 'https://api.github.com';

export const createDefaultTask = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
) => {
	const httpService = new HttpService();

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

	labels = uniq(labels, (label) => label.name);
	const tags: ITag[] = await createTags(
		connection,
		labels,
		tenant,
		organization
	);

	const defaultProjects = await connection.manager.find(OrganizationProject);
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
		const maxTaskNumber = await getMaxTaskNumberByProject(connection, {
			tenantId: tenant.id,
			organizationId: organization.id,
			projectId: project.id
		});

		const task = new Task();
		task.tags = filter(tags, (tag: ITag) => !!issue.labels.find((label: any) => label.name === tag.name));
		task.tenant = tenant;
		task.organization = organization;
		task.title = issue.title;
		task.description = issue.body;
		task.status = status;
		task.estimate = null;
		task.dueDate = faker.date.future(0.3);
		task.project = project;
		task.prefix = project.name.substring(0, 3);
		task.number = maxTaskNumber + 1;
		task.creator = faker.random.arrayElement(users);

		if (count % 2 === 0) {
			task.members = faker.random.arrayElements(employees, 5);
		} else {
			task.teams = [faker.random.arrayElement(teams)];
		}
		await connection.manager.save(task);
		count++;
	}
};

export const createRandomTask = async (
	connection: Connection,
	tenants: ITenant[]
) => {
	const httpService = new HttpService();

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

	labels = uniq(labels, (label) => label.name);

	for await (const tenant of tenants || []) {
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
			const projects = await connection.manager.find(OrganizationProject, {
				where: {
					tenant,
					organization
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
					tenant,
					organization
				}
			});

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
				const maxTaskNumber = await getMaxTaskNumberByProject(connection, {
					tenantId: tenant.id,
					organizationId: organization.id,
					projectId: project.id
				});

				const task = new Task();
				task.tags = filter(tags, (tag: ITag) => !!issue.labels.find((label: any) => label.name === tag.name));
				task.title = issue.title;
				task.description = issue.body;
				task.status = status;
				task.estimate = null;
				task.dueDate = null;
				task.project = project;
				task.prefix = project.name.substring(0, 3);
				task.number = maxTaskNumber + 1;
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

/**
 * GET maximum task number by project filter
 * 
 * @param options 
 */
export async function getMaxTaskNumberByProject(
	connection: Connection,
	options: IGetTaskOptions
) {
	const { tenantId, organizationId, projectId } = options;
	/**
	 * GET maximum task number by project
	 */
	const query = connection.createQueryBuilder(Task, 'task');
	query.select(`COALESCE(MAX("${query.alias}"."number"), 0)`, "maxTaskNumber");
	query.andWhere(
		new Brackets((qb: WhereExpressionBuilder) => {
			qb.andWhere(`"${query.alias}"."organizationId" =:organizationId`, { organizationId });
			qb.andWhere(`"${query.alias}"."tenantId" =:tenantId`, { tenantId });
			if (isNotEmpty(projectId)) {
				qb.andWhere(`"${query.alias}"."projectId" = :projectId`, { projectId });
			} else {
				qb.andWhere(`"${query.alias}"."projectId" IS NULL`);
			}
		})
	);
	const { maxTaskNumber } = await query.getRawOne();
	return maxTaskNumber;
}