import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { PipelineStage } from './pipeline-stage.entity';
import { Pipeline } from './../core/entities/internal';

export const createRandomPipelineStage = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<PipelineStage[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, pipeline stages not be created'
		);
		return;
	}

	const pipelineStages: PipelineStage[] = [];
	for (const tenant of tenants) {
		const tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			const organizationPipeline = await connection.manager.find(Pipeline, {
				where: { organization: tenantOrg }
			});
			for (const pipeline of organizationPipeline) {
				for (let i = 0; i <= faker.datatype.number(10); i++) {
					//todo Need to update with real values
					const pipelineStage = new PipelineStage();
					pipelineStage.pipeline = pipeline;
					pipelineStage.pipelineId = pipeline.id;
					pipelineStage.name = faker.company.companyName();
					pipelineStage.description = faker.name.jobDescriptor();
					pipelineStage.index = Math.floor(Math.random() * 99999) + 1;
					pipelineStage.tenant = tenant;
					pipelineStage.organization = tenantOrg;
					pipelineStages.push(pipelineStage);
				}
			}
		}
	}

	return await insertRandomPipelineStage(connection, pipelineStages);
};

const insertRandomPipelineStage = async (
	connection: Connection,
	pipelineStages: PipelineStage[]
) => await connection.manager.save(pipelineStages);
