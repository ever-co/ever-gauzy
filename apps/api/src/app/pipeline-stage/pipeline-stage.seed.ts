import { Connection } from 'typeorm';
import { PipelineStage } from './pipeline-stage.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '@gauzy/models';
import { Pipeline } from '../pipeline/pipeline.entity';

export const createRandomPipelineStage = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<PipelineStage[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, pipeline stages not be created'
		);
		return;
	}

	let pipelineStages: PipelineStage[] = [];

	for (const tenant of tenants) {
		let tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			const organizationPipeline = await connection.manager.find(
				Pipeline,
				{
					where: [{ organization: tenantOrg }]
				}
			);

			for (const pipeline of organizationPipeline) {
				for (let i = 0; i <= faker.random.number(10); i++) {
					//todo Need to update with real values
					let pipelineStage = new PipelineStage();

					pipelineStage.pipeline = pipeline;
					pipelineStage.pipelineId = pipeline.id;
					pipelineStage.name = faker.company.companyName();
					pipelineStage.description = faker.name.jobDescriptor();
					pipelineStage.index = Math.floor(Math.random() * 99999) + 1;

					pipelineStages.push(pipelineStage);
				}
			}
		}
	}

	await insertRandomPipelineStage(connection, pipelineStages);
	return pipelineStages;
};

const insertRandomPipelineStage = async (
	connection: Connection,
	data: PipelineStage[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(PipelineStage)
		.values(data)
		.execute();
};
