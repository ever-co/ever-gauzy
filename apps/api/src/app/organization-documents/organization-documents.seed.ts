import { Connection } from 'typeorm';
import { OrganizationDocuments } from './organization-documents.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import * as faker from 'faker';

export const createOrganizationDocuments = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
): Promise<OrganizationDocuments[]> => {
	const documents: OrganizationDocuments[] = [];

	for (const organization of organizations) {
		const requestPaidDaysOff = new OrganizationDocuments();
		const requestUnpaidDaysOff = new OrganizationDocuments();

		requestPaidDaysOff.name = 'Paid Days off Request';
		requestPaidDaysOff.organizationId = organization.id;
		requestPaidDaysOff.tenant = tenant;
		requestPaidDaysOff.documentUrl =
			'http://res.cloudinary.com/evereq/image/upload/v1595424362/everbie-products-images/qanadywgn3gxte7kwtwu.pdf';

		requestUnpaidDaysOff.name = 'Unpaid Days off Request';
		requestUnpaidDaysOff.documentUrl =
			'http://res.cloudinary.com/evereq/image/upload/v1595506200/everbie-products-images/am3ujibzu660swicfcsw.pdf';
		requestUnpaidDaysOff.organizationId = organization.id;
		requestUnpaidDaysOff.tenant = tenant;

		documents.push(requestPaidDaysOff);
		documents.push(requestUnpaidDaysOff);
	}

	return await connection.manager.save(documents);
};

export const createRandomOrganizationDocuments = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<OrganizationDocuments[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Organization Documents will not be created'
		);
		return;
	}

	const organizationDocuments: OrganizationDocuments[] = [];
	const json = {
		'Paid Days off Request':
			'http://res.cloudinary.com/evereq/image/upload/v1595424362/everbie-products-images/qanadywgn3gxte7kwtwu.pdf',
		'Unpaid Days off Request':
			'http://res.cloudinary.com/evereq/image/upload/v1595506200/everbie-products-images/am3ujibzu660swicfcsw.pdf'
	};

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const organizationDocument = new OrganizationDocuments();

			organizationDocument.name = faker.random.arrayElement([
				'Paid Days off Request',
				'Unpaid Days off Request'
			]);
			organizationDocument.organizationId = tenantOrg.id;
			organizationDocument.tenant = tenant;
			organizationDocument.documentUrl = json[organizationDocument.name];

			organizationDocuments.push(organizationDocument);
		}
	}

	await connection.manager.save(organizationDocuments);
};
