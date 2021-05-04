import { Connection } from 'typeorm';
import { Pipeline } from './pipeline.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { IOrganization } from '@gauzy/contracts';

export const createDefaultPipeline = async (
	connection: Connection,
	tenant: Tenant,
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
	pipelines = await dataOperation(
		connection,
		tenant,
		pipelines,
		tenantOrganizations
	);
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
		const tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			pipelines = await dataOperation(
				connection,
				tenant,
				pipelines,
				tenantOrg
			);
		}
	}

	return pipelines;
};

const dataOperation = async (
	connection: Connection,
	tenant,
	pipelines,
	organization
) => {
	for (let i = 0; i <= faker.datatype.number(10); i++) {
		const pipeline = new Pipeline();

		pipeline.organization = organization;
		pipeline.tenant = tenant;
		pipeline.organizationId = organization.id;
		pipeline.name = faker.company.companyName();
		pipeline.description = faker.name.jobDescriptor();
		pipeline.isActive = faker.datatype.boolean();

		pipelines.push(pipeline);
	}
	await connection.manager.save(pipelines);
	return pipelines;
};
