import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JsonData } from '@gauzy/contracts';import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { Unit } from './unit.entity';
import { MikroOrmUnitCategoryRepository } from './repository/mikro-orm-unit-category.repository';

/**
 * One family of measurement — count, mass, length, volume, area, time — inside which conversion is
 * defined.
 *
 * The family is what turns "10" and "120" from two numbers into two *quantities*: conversion is
 * valid only between two units of one family, so the family is the thing that makes a stock ledger
 * sum an arithmetic claim rather than a comparison of two numbers that may denote different amounts
 * of goods. It is a row rather than a self-referential tree of units because a tree's root *is* the
 * reference unit: in a tree, changing an intermediate node silently restates every descendant,
 * whereas with one absolute factor per unit a unit's meaning changes only when that unit changes.
 *
 * `isSystem` protects a seeded family from deletion but not from editing, which is the platform's
 * existing protected-master-data idiom — a seeded family an operator cannot correct would be a
 * taxonomy the platform owns and the tenant cannot.
 */
@MultiORMEntity('unit_category', { mikroOrmRepository: () => MikroOrmUnitCategoryRepository })
export class UnitCategory extends TenantOrganizationBaseEntity {
	/**
	 * Machine key, unique per organization: `COUNT`, `MASS`, `LENGTH`, `VOLUME`, `AREA`, `TIME`.
	 *
	 * Deliberately a string rather than an enumeration — see `measurement.constants.ts`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32 })
	code: string;

	/**
	 * Display name.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	name: string;

	/**
	 * A seeded family: editable, never deletable.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isSystem: boolean;

	/**
	 * The units declared inside this family. At most one of them carries `isReference`.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@MultiORMOneToMany(() => Unit, (unit) => unit.category)
	units?: Unit[];

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
