import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { PipelineStage } from './pipeline-stage.entity';
import { Pipeline } from './../core/entities/internal';

export const createRandomPipelineStage = async (
	dataSource: DataSource,
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
		const { id: tenantId } = tenant;
		const tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			const { id: organizationId } = tenantOrg;
			const organizationPipeline = await dataSource.manager.findBy(Pipeline, {
				organizationId,
				tenantId
			});
			for (const pipeline of organizationPipeline) {
				for (let i = 0; i <= faker.number.int(10); i++) {
					//todo Need to update with real values
					const pipelineStage = new PipelineStage();
					pipelineStage.pipeline = pipeline;
					pipelineStage.pipelineId = pipeline.id;
					pipelineStage.name = faker.company.name();
					pipelineStage.description = faker.person.jobDescriptor();
					pipelineStage.index = Math.floor(Math.random() * 99999) + 1;
					pipelineStage.tenant = tenant;
					pipelineStage.organization = tenantOrg;
					pipelineStages.push(pipelineStage);
				}
			}
		}
	}

	return await insertRandomPipelineStage(dataSource, pipelineStages);
};

const insertRandomPipelineStage = async (
	dataSource: DataSource,
	pipelineStages: PipelineStage[]
) => await dataSource.manager.save(pipelineStages);
