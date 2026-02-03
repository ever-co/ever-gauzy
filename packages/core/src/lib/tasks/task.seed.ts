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
	issues.forEach((issue) => {
		labels = labels.concat(issue.labels);
	});

	labels = uniq(labels, (label) => label.name);
	const tags: ITag[] = await createTags(dataSource, labels, tenant, organization);

	const defaultProjects = await dataSource.manager.find(OrganizationProject);
	if (!defaultProjects) {
		console.warn('Warning: projects not found, DefaultTasks will not be created');
		return;
	}
	const teams = await dataSource.manager.find(OrganizationTeam, {
		where: {
			tenantId: tenant.id,
			organizationId: organization.id
		},
		relations: ['members', 'members.employee']
	});
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

		// Assign tasks to teams more frequently (70% to teams, 30% to individual members)
		// This ensures teams have tasks assigned to them
		if (count % 10 < 7 && teams.length > 0) {
			// Assign to 1-2 teams
			const numberOfTeams = faker.number.int({ min: 1, max: Math.min(2, teams.length) });
			const selectedTeams = faker.helpers.arrayElements(teams, numberOfTeams);
			task.teams = selectedTeams;

			// Also assign the task to specific members from the selected teams
			const teamMembers: Employee[] = [];
			for (const team of selectedTeams) {
				if (team.members && team.members.length > 0) {
					// Select 1-3 random members from each team
					const numberOfMembers = faker.number.int({ min: 1, max: Math.min(3, team.members.length) });
					const selectedMembers = faker.helpers.arrayElements(team.members, numberOfMembers);
					// Extract the employee from each OrganizationTeamEmployee
					teamMembers.push(...selectedMembers.map((m) => m.employee).filter(Boolean));
				}
			}
			// Assign unique members to the task
			task.members = [...new Map(teamMembers.map((emp) => [emp.id, emp])).values()];
		} else if (employees.length > 0) {
			task.members = faker.helpers.arrayElements(employees, faker.number.int({ min: 1, max: 5 }));
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
	issues.forEach((issue) => {
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
			const teams = await dataSource.manager.find(OrganizationTeam, {
				where: {
					tenantId,
					organizationId
				},
				relations: ['members', 'members.employee']
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
				task.createdByUser = faker.helpers.arrayElement(users);
				task.organization = organization;
				task.tenant = tenant;

				// Assign tasks to teams more frequently (70% to teams, 30% to individual members)
				// This ensures teams have tasks assigned to them
				if (count % 10 < 7 && teams.length > 0) {
					// Assign to 1-2 teams
					const numberOfTeams = faker.number.int({ min: 1, max: Math.min(2, teams.length) });
					const selectedTeams = faker.helpers.arrayElements(teams, numberOfTeams);
					task.teams = selectedTeams;

					// Also assign the task to specific members from the selected teams
					const teamMembers: Employee[] = [];
					for (const team of selectedTeams) {
						if (team.members && team.members.length > 0) {
							// Select 1-3 random members from each team
							const numberOfMembers = faker.number.int({ min: 1, max: Math.min(3, team.members.length) });
							const selectedMembers = faker.helpers.arrayElements(team.members, numberOfMembers);
							// Extract the employee from each OrganizationTeamEmployee
							teamMembers.push(...selectedMembers.map((m) => m.employee).filter(Boolean));
						}
					}
					// Assign unique members to the task
					task.members = [...new Map(teamMembers.map((emp) => [emp.id, emp])).values()];
				} else if (employees.length > 0) {
					task.members = faker.helpers.arrayElements(employees, faker.number.int({ min: 1, max: 5 }));
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
