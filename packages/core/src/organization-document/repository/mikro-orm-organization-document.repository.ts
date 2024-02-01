import { EntityRepository } from '@mikro-orm/core';
import { OrganizationDocument } from '../organization-document.entity';

export class MikroOrmOrganizationDocumentRepository extends EntityRepository<OrganizationDocument> { }