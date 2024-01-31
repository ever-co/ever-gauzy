import { Repository } from 'typeorm';
import { OrganizationDocument } from '../organization-document.entity';

export class TypeOrmOrganizationDocumentRepository extends Repository<OrganizationDocument> { }