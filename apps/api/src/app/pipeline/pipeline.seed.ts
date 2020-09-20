import { Connection } from 'typeorm';
import { Pipeline } from './pipeline.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { IOrganization } from '@gauzy/models';

export const createDefaultPipeline = async (
	connection: Connection,
	tenantOrganizations
): Promise<Pipeline[]> => {
	if (!tenantOrganizations) {
		console.warn(
			'Warning: tenantOrganizations not found, Default pipeline not be created'
		);
		return;
	}

	let pipelines: Pipeline[] = [];
	// for (const tenantOrg of tenantOrganizations) {
	pipelines = await dataOperation(connection, pipelines, tenantOrganizations);
	// }
	return pipelines;
};

export const createRandomPipeline = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
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
			pipelines = await dataOperation(connection, pipelines, tenantOrg);
		}
	}

	return pipelines;
};

const dataOperation = async (
	connection: Connection,
	pipelines,
	organization
) => {
	for (let i = 0; i <= faker.random.number(10); i++) {
		let pipeline = new Pipeline();

		pipeline.organization = organization;
		pipeline.organizationId = organization.id;
		pipeline.name = faker.company.companyName();
		pipeline.description = faker.name.jobDescriptor();
		pipeline.isActive = faker.random.boolean();

		pipelines.push(pipeline);
	}
	await connection.manager.save(pipelines);
	return pipelines;
};
