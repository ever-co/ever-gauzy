import { NotFoundException, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { DecimalString, ID } from '@gauzy/contracts';
import { Unit } from './unit.entity';
import { UnitService } from './unit.service';
import { MEASUREMENT_PERMISSIONS } from './measurement.permissions';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';

/** The members `CreateUnitInput` declares in the schema. */
export interface ICreateUnitInput {
	organizationId: string;
	categoryId: string;
	code: string;
	name: string;
	symbol?: string;
	factor?: DecimalString;
	isReference?: boolean;
	decimalPlaces?: number;
}

/** The members `UpdateUnitInput` declares in the schema. */
export interface IUpdateUnitInput {
	id: string;
	organizationId: string;
	name?: string;
	symbol?: string;
	factor?: DecimalString;
	decimalPlaces?: number;
}

/**
 * The units inside a family, over GraphQL.
 *
 * The conversion field is the platform's single conversion entry point on this surface, and it is the
 * same operation `POST /api/units/convert` performs: the arithmetic happens once, on exact decimals,
 * and two units of different families are refused rather than combined into a number that means
 * nothing.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Unit')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
export class UnitResolver {
	constructor(private readonly unitService: UnitService) {}

	/**
	 * The units of the caller's organization, optionally narrowed to one family.
	 */
	@Query('units')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	async units(@Args('categoryId', { nullable: true }) categoryId?: ID): Promise<Unit[]> {
		if (categoryId) {
			return this.unitService.listByCategory(categoryId);
		}

		const { items } = await this.unitService.findAll();

		return items;
	}

	/**
	 * One unit, or `null` when this organization has none with that id.
	 */
	@Query('unit')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	async unit(@Args('id', ParseUUIDPipe) id: string): Promise<Unit | null> {
		try {
			return await this.unitService.getUnit(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Declares a unit inside a family that already has a reference.
	 */
	@Mutation('createUnit')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	async createUnit(@Args('input') input: ICreateUnitInput): Promise<Unit> {
		await this.unitService.getReferenceUnit(input.categoryId);

		return this.unitService.create(input as unknown as Partial<Unit>);
	}

	/**
	 * Changes a unit's name, symbol, factor or granularity.
	 */
	@Mutation('updateUnit')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	async updateUnit(@Args('input') input: IUpdateUnitInput): Promise<Unit> {
		await this.unitService.getUnit(input.id);

		const values: Partial<Unit> = {};

		if (input.name !== undefined) values.name = input.name;
		if (input.symbol !== undefined) values.symbol = input.symbol;
		if (input.decimalPlaces !== undefined) values.decimalPlaces = input.decimalPlaces;
		if (input.factor !== undefined) values.factor = input.factor;

		if (Object.keys(values).length > 0) {
			await this.unitService.update(input.id, values as any);
		}

		return this.unitService.getUnit(input.id);
	}

	/**
	 * Archives a unit.
	 */
	@Mutation('archiveUnit')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	async archiveUnit(@Args('id', ParseUUIDPipe) id: string): Promise<boolean> {
		await this.unitService.getUnit(id);
		await this.unitService.softRemove(id);

		return true;
	}

	/**
	 * Converts a quantity between two units of one family.
	 */
	@Mutation('convertQuantity')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	async convertQuantity(
		@Args('value') value: DecimalString,
		@Args('fromUnitId', ParseUUIDPipe) fromUnitId: ID,
		@Args('toUnitId', ParseUUIDPipe) toUnitId: ID
	): Promise<{ value: DecimalString; fromUnitId: ID; toUnitId: ID }> {
		return {
			value: await this.unitService.convert(value, fromUnitId, toUnitId),
			fromUnitId,
			toUnitId
		};
	}
}
