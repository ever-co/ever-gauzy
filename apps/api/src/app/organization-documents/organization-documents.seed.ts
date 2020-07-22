import { Connection } from 'typeorm';
import { OrganizationDocuments } from './organization-documents.entity';
import { Organization } from '../organization/organization.entity';

export const createOrganizationDocuments = async (
	connection: Connection,
	organizations: Organization[]
): Promise<OrganizationDocuments[]> => {
	const documents: OrganizationDocuments[] = [];

	for (const organization of organizations) {
		const document = new OrganizationDocuments();

		document.name = 'Request Days Off';
		document.organizationId = organization.id;
		document.documentUrl =
			'http://res.cloudinary.com/evereq/image/upload/v1595424362/everbie-products-images/qanadywgn3gxte7kwtwu.pdf';

		documents.push(document);
	}

	return await connection.manager.save(documents);
};
