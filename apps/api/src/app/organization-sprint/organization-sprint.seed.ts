import { Connection } from 'typeorm';
import * as faker from 'faker';
import { OrganizationSprint } from './organization-sprint.entity';
import { Organization, SprintStartDayEnum } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import * as moment from 'moment';
import { Task } from '../tasks/task.entity';

export const createRandomOrganizationSprint = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
) => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Random OrganizationSprint will not be created'
		);
		return;
	}

	const sprints: OrganizationSprint[] = [];
	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		for (const org of orgs) {
			const orgProjects = await connection.manager.find(
				OrganizationProjects,
				{
					where: [{ organization: org }]
				}
			);
			let project = faker.random.arrayElement(orgProjects);

			const tasks = await connection.manager.find(Task, {
				where: [{ project: project }]
			});
			for (let i = 0; i <= faker.random.number(10); i++) {
				const sprint = new OrganizationSprint();

				sprint.name = faker.company.companyName();
				sprint.projectId = project.id;
				sprint.length = faker.random.number({ min: 1, max: 9 });
				sprint.startDate = faker.date.past();
				sprint.endDate = moment(sprint.startDate)
					.add(1, 'months')
					.toDate();
				sprint.isActive = faker.random.boolean();
				sprint.dayStart = SprintStartDayEnum.MONDAY;
				sprint.organizationId = org.id;
				sprint.organization = org;
				sprint.tasks = tasks;

				// TODO: which goal
				// sprint.goal = '';

				sprints.push(sprint);
			}
		}
	}
	await connection.manager.save(sprints);
};
