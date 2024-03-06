import { ManyToOne, OneToMany, OneToOne, ManyToMany } from "@mikro-orm/core";

/**
 * Mikro-ORM Decorator Aliases.
 *
 * This module provides aliases for commonly used Mikro-ORM decorators.
 * It simplifies import statements and enhances code readability.
 */
export {
    ManyToOne as MikroOrmManyToOne,
    OneToMany as MikroOrmOneToMany,
    OneToOne as MikroOrmOneToOne,
    ManyToMany as MikroOrmManyToMany,
};
