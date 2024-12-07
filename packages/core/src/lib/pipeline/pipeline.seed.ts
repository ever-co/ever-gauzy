import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IOrganization, IPipeline, ITenant } from '@gauzy/contracts';
import { Pipeline } from './pipeline.entity';

export const createDefaultPipeline = async (
	dataSource: DataSource,
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
		dataSource,
		tenant,
		pipelines,
		tenantOrganizations
	);
	return pipelines;
};

export const createRandomPipeline = async (
	dataSource: DataSource,
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
				dataSource,
				tenant,
				pipelines,
				tenantOrg
			);
		}
	}
	return pipelines;
};

const dataOperation = async (
	dataSource: DataSource,
	tenant: ITenant,
	pipelines: IPipeline[],
	organization: IOrganization
) => {
	for (let i = 0; i <= faker.number.int(10); i++) {
		const pipeline = new Pipeline();

		pipeline.organization = organization;
		pipeline.tenant = tenant;
		pipeline.organizationId = organization.id;
		pipeline.name = faker.company.name();
		pipeline.description = faker.person.jobDescriptor();
		pipeline.isActive = faker.datatype.boolean();

		pipelines.push(pipeline);
	}
	await dataSource.manager.save(pipelines);
	return pipelines;
};
