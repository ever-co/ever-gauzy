import { MikroOrmTagEntityCustomField } from './mikro-orm-tag-entity-custom-field';
import { TypeOrmTagEntityCustomField } from './type-orm-tag-entity-custom-field';

export * from './mikro-orm-tag-entity-custom-field';
export * from './type-orm-tag-entity-custom-field';

// Union type representing either TypeORM or MikroORM field
export type TagEntityCustomFields = TypeOrmTagEntityCustomField | MikroOrmTagEntityCustomField;
