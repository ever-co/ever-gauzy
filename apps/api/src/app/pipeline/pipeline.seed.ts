import { Connection } from 'typeorm';
import { Pipeline } from './pipeline.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '@gauzy/models';

export const createRandomPipeline = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<Pipeline[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, pipeline not be created'
		);
		return;
	}

	let pipelines: Pipeline[] = [];

	for (const tenant of tenants) {
		let tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			for (let i = 0; i <= faker.random.number(10); i++) {
				//todo Need to update with real values
				let pipeline = new Pipeline();

				pipeline.organization = tenantOrg;
				pipeline.organizationId = tenantOrg.id;
				pipeline.name = faker.company.companyName();
				pipeline.description = faker.name.jobDescriptor();

				pipelines.push(pipeline);
			}
		}
	}

	await insertRandomPipeline(connection, pipelines);
	return pipelines;
};

const insertRandomPipeline = async (
	connection: Connection,
	data: Pipeline[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Pipeline)
		.values(data)
		.execute();
};
