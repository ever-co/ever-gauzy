import { MikroOrmEmployeeEntityCustomFields } from './mikro-orm-employee-entity-custom-fields';
import { TypeOrmEmployeeEntityCustomFields } from './type-orm-employee-entity-custom-fields';

export * from './mikro-orm-employee-entity-custom-fields';
export * from './type-orm-employee-entity-custom-fields';

// Union type representing either TypeORM or MikroORM field
export type EmployeeEntityCustomFields = TypeOrmEmployeeEntityCustomFields | MikroOrmEmployeeEntityCustomFields;
