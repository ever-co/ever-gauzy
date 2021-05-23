import { Connection } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { Deal } from './deal.entity';
import * as faker from 'faker';
import { Pipeline, PipelineStage } from './../core/entities/internal';

export const createRandomDeal = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<Deal[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, deal  will not be created'
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

	for (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		const tenantOrgs = tenantOrganizationsMap.get(tenant);

		for (const tenantEmployee of tenantEmployees) {
			for (const tenantOrg of tenantOrgs) {
				const pipelines = await connection.manager.find(Pipeline, {
					where: [{ organization: tenantOrg }]
				});
				for (const pipeline of pipelines) {
					const pipelineStages = await connection.manager.find(
						PipelineStage,
						{
							where: [{ pipeline: pipeline }]
						}
					);
					for (const pipelineStage of pipelineStages) {
						const deal = new Deal();

						deal.createdBy = tenantEmployee.user;
						deal.stage = pipelineStage;
						deal.title = faker.name.jobTitle();
						deal.createdByUserId = tenantEmployee.user.id;
						deal.stageId = pipelineStage.id;
						deal.organization = tenantOrg;
						deal.probability = faker.datatype.number(5);
						deal.tenant = tenant;

						deals.push(deal);
					}
				}
			}
		}
	}

	await connection.manager.save(deals);
};
