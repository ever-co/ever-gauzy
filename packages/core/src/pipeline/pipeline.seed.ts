import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IOrganization, IPipeline, ITenant } from '@gauzy/contracts';
import { Pipeline } from './pipeline.entity';

export const createDefaultPipeline = async (
	connection: Connection,
	tenant: ITenant,
	tenantOrganizations
): Promise<IPipeline[]> => {
	if (!tenantOrganizations) {
		console.warn(
			'Warning: tenantOrganizations not found, Default pipeline not be created'
		);
		return;
	}

	let pipelines: IPipeline[] = [];
	pipelines = await dataOperation(
		connection,
		tenant,
		pipelines,
		tenantOrganizations
	);
	return pipelines;
};

export const createRandomPipeline = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IPipeline[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, pipeline not be created'
		);
		return;
	}
	let pipelines: IPipeline[] = [];
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
	tenant: ITenant,
	pipelines: IPipeline[],
	organization: IOrganization
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
