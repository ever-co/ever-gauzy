import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { Deal } from './deal.entity';
import { faker } from '@faker-js/faker';
import { Pipeline, PipelineStage } from './../core/entities/internal';

export const createRandomDeal = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<Deal[]> => {
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, deal  will not be created'
		);
		return;
	}
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, deal  will not be created'
		);
		return;
	}

	const deals: Deal[] = [];

	for await (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for await (const tenantOrg of tenantOrgs) {
			const { id: tenantId } = tenant;
			const { id: organizationId } = tenantOrg;
			const pipelines = await dataSource.manager.findBy(Pipeline, {
				organizationId,
				tenantId
			});
			const tenantEmployees = organizationEmployeesMap.get(tenantOrg);
			for await (const tenantEmployee of tenantEmployees) {
				for (const pipeline of pipelines) {
					const { id: pipelineId } = pipeline;
					const pipelineStages = await dataSource.manager.findBy(PipelineStage, {
						pipelineId
					});
					for (const pipelineStage of pipelineStages) {
						const deal = new Deal();
						deal.createdBy = tenantEmployee.user;
						deal.stage = pipelineStage;
						deal.title = faker.person.jobTitle();
						deal.createdByUserId = tenantEmployee.user.id;
						deal.stageId = pipelineStage.id;
						deal.organization = tenantOrg;
						deal.probability = faker.number.int(5);
						deal.tenant = tenant;
						deals.push(deal);
					}
				}
			}
		}
	}

	await dataSource.manager.save(deals);
};
