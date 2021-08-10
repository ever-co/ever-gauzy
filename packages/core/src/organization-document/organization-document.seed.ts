import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IOrganization, IOrganizationDocument, ITenant } from '@gauzy/contracts';
import { OrganizationDocument } from './organization-document.entity';

export const createOrganizationDocuments = async (
	connection: Connection,
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
	return await connection.manager.save(documents);
};

export const createRandomOrganizationDocuments = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IOrganizationDocument[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Organization Documents will not be created'
		);
		return;
	}

	const organizationDocuments: IOrganizationDocument[] = [];
	const json = {
		'Paid Days off Request':
			'http://res.cloudinary.com/evereq/image/upload/v1595424362/everbie-products-images/qanadywgn3gxte7kwtwu.pdf',
		'Unpaid Days off Request':
			'http://res.cloudinary.com/evereq/image/upload/v1595506200/everbie-products-images/am3ujibzu660swicfcsw.pdf'
	};

	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);

		for await (const organization of organizations) {
			const document = new OrganizationDocument();
			document.name = faker.random.arrayElement([
				'Paid Days off Request',
				'Unpaid Days off Request'
			]);
			document.organization = organization;
			document.tenant = tenant;
			document.documentUrl = json[document.name];
			organizationDocuments.push(document);
		}
	}

	await connection.manager.save(organizationDocuments);
};
