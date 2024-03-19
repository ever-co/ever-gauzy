import { EntityRepository } from '@mikro-orm/knex';
import { OrganizationDocument } from '../organization-document.entity';

export class MikroOrmOrganizationDocumentRepository extends EntityRepository<OrganizationDocument> { }
