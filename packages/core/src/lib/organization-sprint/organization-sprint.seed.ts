import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { OrganizationSprint } from './organization-sprint.entity';
import { IOrganization, ITenant, SprintStartDayEnum } from '@gauzy/contracts';
import { OrganizationProject } from '../organization-project/organization-project.entity';
import moment from 'moment';
import { Task } from '../tasks/task.entity';

export const createRandomOrganizationSprint = async (
	dataSource: DataSource,
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
		const { id: tenantId } = tenant;
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const { id: organizationId } = organization;
			const projects = await dataSource.getRepository(OrganizationProject).findBy({
				tenantId,
				organizationId
			});
			let project = faker.helpers.arrayElement(projects);

			const { id: projectId } = project;
			const tasks = await dataSource.getRepository(Task).findBy({
				projectId
			});
			for (let i = 0; i <= faker.number.int(10); i++) {
				const sprint = new OrganizationSprint();

				sprint.name = faker.company.name();
				sprint.projectId = project.id;
				sprint.length = faker.number.int({ min: 1, max: 9 });
				sprint.startDate = faker.date.past();
				sprint.endDate = moment(sprint.startDate)
					.add(1, 'months')
					.toDate();
				sprint.isActive = faker.datatype.boolean();
				sprint.dayStart = SprintStartDayEnum.MONDAY;
				sprint.organizationId = organizationId;
				sprint.tenantId = tenantId;
				sprint.tasks = tasks;
				sprints.push(sprint);
			}
		}
	}
	await dataSource.manager.save(sprints);
};
