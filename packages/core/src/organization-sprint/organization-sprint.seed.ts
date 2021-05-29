import { Connection } from 'typeorm';
import * as faker from 'faker';
import { OrganizationSprint } from './organization-sprint.entity';
import { IOrganization, ITenant, SprintStartDayEnum } from '@gauzy/contracts';
import { OrganizationProject } from '../organization-projects/organization-projects.entity';
import * as moment from 'moment';
import { Task } from '../tasks/task.entity';

export const createRandomOrganizationSprint = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
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
				OrganizationProject,
				{
					where: [{ organization: org }]
				}
			);
			let project = faker.random.arrayElement(orgProjects);

			const tasks = await connection.manager.find(Task, {
				where: [{ project: project }]
			});
			for (let i = 0; i <= faker.datatype.number(10); i++) {
				const sprint = new OrganizationSprint();

				sprint.name = faker.company.companyName();
				sprint.projectId = project.id;
				sprint.length = faker.datatype.number({ min: 1, max: 9 });
				sprint.startDate = faker.date.past();
				sprint.endDate = moment(sprint.startDate)
					.add(1, 'months')
					.toDate();
				sprint.isActive = faker.datatype.boolean();
				sprint.dayStart = SprintStartDayEnum.MONDAY;
				sprint.organizationId = org.id;
				sprint.organization = org;
				sprint.tasks = tasks;
				sprint.tenant = tenant;

				// TODO: which goal
				// sprint.goal = '';

				sprints.push(sprint);
			}
		}
	}
	await connection.manager.save(sprints);
};
