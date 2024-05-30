import { Property } from '@mikro-orm/core';

export const __FIX_RELATIONAL_CUSTOM_FIELDS__ = 'fix_relational_custom_fields';

// Define a new entity that extends the abstract base class
export abstract class MikroOrmBaseCustomEntityFields {
	/**
	 * If there are only relations are defined for an Entity for customFields, then TypeORM not saving realtions for entity ("Cannot set properties of undefined (<fieldName>)").
	 * So we have to add a "fake" column to the customFields embedded type to prevent this error from occurring.
	 */
	@Property({ type: 'boolean', nullable: true, hidden: true })
	[__FIX_RELATIONAL_CUSTOM_FIELDS__]: boolean;
}
