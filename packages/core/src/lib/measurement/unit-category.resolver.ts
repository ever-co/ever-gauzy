import { NotFoundException, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnitCategory } from './unit-category.entity';
import { UnitCategoryService } from './unit-category.service';
import { MEASUREMENT_PERMISSIONS } from './measurement.permissions';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';

/** The members `CreateUnitCategoryInput` declares in the schema. */
export interface ICreateUnitCategoryInput {
	organizationId: string;
	code: string;
	name: string;
	isSystem?: boolean;
	reference: {
		code: string;
		name: string;
		symbol?: string;
		decimalPlaces?: number;
	};
}

/** The members `UpdateUnitCategoryInput` declares in the schema. */
export interface IUpdateUnitCategoryInput {
	id: string;
	organizationId: string;
	name?: string;
}

/**
 * The measurement families, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `UnitCategoryService` the `/api/unit-categories` routes
 * call, under the same guard chain and the same permissions. What it owns is the transport-shaped
 * work — reading arguments, validating them and answering in the shape the schema declares.
 *
 * `organizationId` arrives on both inputs because the schema declares it, and it is never trusted:
 * the service scopes every read to the caller's tenant and organization, so an input naming another
 * organization cannot reach a row of one.
 */
@Resolver('UnitCategory')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
export class UnitCategoryResolver {
	constructor(private readonly unitCategoryService: UnitCategoryService) {}

	/**
	 * The measurement families of the caller's organization.
	 */
	@Query('unitCategories')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	async unitCategories(): Promise<UnitCategory[]> {
		const { items } = await this.unitCategoryService.findAll();

		return items;
	}

	/**
	 * One family. The field is nullable in the schema, so a family that does not exist — or that
	 * belongs to another organization, which reads identically from here — answers `null`.
	 */
	@Query('unitCategory')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_VIEW)
	async unitCategory(@Args('id', ParseUUIDPipe) id: string): Promise<UnitCategory | null> {
		try {
			return await this.unitCategoryService.getCategory(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Declares a family together with the reference unit that defines it.
	 */
	@Mutation('createUnitCategory')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	async createUnitCategory(@Args('input') input: ICreateUnitCategoryInput): Promise<UnitCategory> {
		return this.unitCategoryService.createCategoryWithReference(input);
	}

	/**
	 * Renames a family.
	 */
	@Mutation('updateUnitCategory')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	async updateUnitCategory(@Args('input') input: IUpdateUnitCategoryInput): Promise<UnitCategory> {
		// Tenant- and organization-scoped, and it throws when the family is not this caller's — which is
		// what keeps the update below from reaching another tenant's row.
		await this.unitCategoryService.getCategory(input.id);

		if (input.name !== undefined) {
			await this.unitCategoryService.update(input.id, { name: input.name } as any);
		}

		return this.unitCategoryService.getCategory(input.id);
	}

	/**
	 * Archives a family.
	 *
	 * The field answers `Boolean` rather than the archived row, and the row is archived rather than
	 * deleted: a family referenced by a unit is never hard-deleted, because the units inside it are what
	 * every quantity expressed in the family means.
	 */
	@Mutation('archiveUnitCategory')
	@Permissions(MEASUREMENT_PERMISSIONS.UNITS_EDIT)
	async archiveUnitCategory(@Args('id', ParseUUIDPipe) id: string): Promise<boolean> {
		await this.unitCategoryService.getCategory(id);
		await this.unitCategoryService.softRemove(id);

		return true;
	}
}
