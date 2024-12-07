import { TypeOrmOrganizationProjectEntityCustomFields } from './type-orm-organization-project-entity-custom-fields';
import { MikroOrmOrganizationProjectEntityCustomFields } from './mikro-orm-organization-project-entity-custom-fields';

export * from './mikro-orm-organization-project-entity-custom-fields';
export * from './type-orm-organization-project-entity-custom-fields';

// Union type representing either TypeORM or MikroORM custom fields
export type OrganizationProjectEntityCustomFields =
	| TypeOrmOrganizationProjectEntityCustomFields
	| MikroOrmOrganizationProjectEntityCustomFields;
