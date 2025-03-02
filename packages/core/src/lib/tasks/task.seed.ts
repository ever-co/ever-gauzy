import { Brackets, DataSource, WhereExpressionBuilder } from 'typeorm';
import { faker } from '@faker-js/faker';
import { filter, uniq } from 'underscore';
import { lastValueFrom, map } from 'rxjs';
import { isNotEmpty } from '@gauzy/utils';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { IGetTaskOptions, IOrganization, ITag, ITenant } from '@gauzy/contracts';
import {
	Organization,
	OrganizationProject,
	OrganizationTeam,
	Tag,
	Task,
	User,
	Employee
} from './../core/entities/internal';
import { prepareSQLQuery as p } from './../database/database.helper';

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
	for await (const issue of issues) {
		const project = faker.helpers.arrayElement(defaultProjects);
		const maxTaskNumber = await getMaxTaskNumberByProject(dataSource, {
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
		task.status = issue.state;
		task.estimate = null;
		task.isDraft = false;
		task.dueDate = faker.date.future({ years: 0.3 });
		task.project = project;
		task.prefix = project.name.substring(0, 3);
		task.number = maxTaskNumber + 1;
		task.createdByUser = faker.helpers.arrayElement(users);

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

	for await (const tenant of tenants || []) {
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
		for await (const organization of organizations) {
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

			for await (const issue of issues) {
				const project = faker.helpers.arrayElement(projects);
				const maxTaskNumber = await getMaxTaskNumberByProject(dataSource, {
					tenantId: tenant.id,
					organizationId: organization.id,
					projectId: project.id
				});

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
				task.number = maxTaskNumber + 1;
				task.teams = [faker.helpers.arrayElement(teams)];
				task.createdByUser = faker.helpers.arrayElement(users);
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
 * GET maximum task number by project filter
 *
 * @param options
 */
export async function getMaxTaskNumberByProject(dataSource: DataSource, options: IGetTaskOptions) {
	const { tenantId, organizationId, projectId } = options;
	/**
	 * GET maximum task number by project
	 */
	const query = dataSource.createQueryBuilder(Task, 'task');
	// Build the query to get the maximum task number
	query.select(p(`COALESCE(MAX("${query.alias}"."number"), 0)`), 'maxTaskNumber');
	query.andWhere(
		new Brackets((qb: WhereExpressionBuilder) => {
			qb.andWhere(p(`"${query.alias}"."organizationId" =:organizationId`), { organizationId });
			qb.andWhere(p(`"${query.alias}"."tenantId" =:tenantId`), { tenantId });

			if (isNotEmpty(projectId)) {
				qb.andWhere(p(`"${query.alias}"."projectId" = :projectId`), { projectId });
			} else {
				qb.andWhere(p(`"${query.alias}"."projectId" IS NULL`));
			}
		})
	);
	const { maxTaskNumber } = await query.getRawOne();
	return maxTaskNumber;
}
