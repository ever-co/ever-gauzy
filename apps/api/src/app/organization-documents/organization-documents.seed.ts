import { Connection } from 'typeorm';
import { OrganizationDocuments } from './organization-documents.entity';
import { Organization } from '../organization/organization.entity';

export const createOrganizationDocuments = async (
	connection: Connection,
	organizations: Organization[]
): Promise<OrganizationDocuments[]> => {
	const documents: OrganizationDocuments[] = [];

	for (const organization of organizations) {
		const requestPaidDaysOff = new OrganizationDocuments();
		const requestUnpaidDaysOff = new OrganizationDocuments();

		requestPaidDaysOff.name = 'Paid Days off Request';
		requestPaidDaysOff.organizationId = organization.id;
		requestPaidDaysOff.documentUrl =
			'http://res.cloudinary.com/evereq/image/upload/v1595424362/everbie-products-images/qanadywgn3gxte7kwtwu.pdf';

		requestUnpaidDaysOff.name = 'Unpaid Days off Request';
		requestUnpaidDaysOff.documentUrl =
			'http://res.cloudinary.com/evereq/image/upload/v1595506200/everbie-products-images/am3ujibzu660swicfcsw.pdf';
		requestUnpaidDaysOff.organizationId = organization.id;

		documents.push(requestPaidDaysOff);
		documents.push(requestUnpaidDaysOff);
	}

	return await connection.manager.save(documents);
};
