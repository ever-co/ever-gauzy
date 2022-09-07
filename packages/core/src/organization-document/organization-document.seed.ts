import { DataSource } from 'typeorm';
import { IOrganization, IOrganizationDocument, ITenant } from '@gauzy/contracts';
import { OrganizationDocument } from './organization-document.entity';

export const createOrganizationDocuments = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<IOrganizationDocument[]> => {
	const documents: IOrganizationDocument[] = [];
	for await (const organization of organizations) {
		const requestPaidDaysOff = new OrganizationDocument({
			name: 'Paid Days off Request',
			organization,
			tenant,
			documentUrl: `http://res.cloudinary.com/evereq/image/upload/v1595424362/everbie-products-images/qanadywgn3gxte7kwtwu.pdf`
		});
		const requestUnpaidDaysOff = new OrganizationDocument({
			name: 'Unpaid Days off Request',
			organization,
			tenant,
			documentUrl: `http://res.cloudinary.com/evereq/image/upload/v1595506200/everbie-products-images/am3ujibzu660swicfcsw.pdf`
		});
		documents.push(requestPaidDaysOff);
		documents.push(requestUnpaidDaysOff);
	}
	return await dataSource.manager.save(documents);
};

export const createRandomOrganizationDocuments = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IOrganizationDocument[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Organization Documents will not be created'
		);
		return;
	}

	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		await createOrganizationDocuments(dataSource, tenant, organizations);
	}
};
