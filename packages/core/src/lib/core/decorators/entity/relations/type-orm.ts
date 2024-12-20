import { ManyToOne, OneToMany, OneToOne, ManyToMany } from "typeorm";

/**
 * TypeORM Decorator Aliases.
 *
 * This module provides aliases for commonly used TypeORM decorators.
 * It simplifies import statements and enhances code readability.
 */
export {
    ManyToOne as TypeOrmManyToOne,
    OneToMany as TypeOrmOneToMany,
    OneToOne as TypeOrmOneToOne,
    ManyToMany as TypeOrmManyToMany,
};
