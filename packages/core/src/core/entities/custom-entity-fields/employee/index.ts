import { MikroOrmEmployeeEntityCustomField } from './mikro-orm-employee-entity-custom-field';
import { TypeOrmEmployeeEntityCustomField } from './type-orm-employee-entity-custom-field';

export * from './mikro-orm-employee-entity-custom-field';
export * from './type-orm-employee-entity-custom-field';

// Union type representing either TypeORM or MikroORM field
export type EmployeeEntityCustomFields = TypeOrmEmployeeEntityCustomField | MikroOrmEmployeeEntityCustomField;
