import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { Coupon } from './coupon.entity';
import { CouponService } from './coupon.service';
import { CreateCouponDTO, UpdateCouponDTO } from './dto';
import { ICoupon, ICouponBatchResult, ICouponCodeFormat } from '../promotion.types';
import { PromotionPermission } from '../promotion.permissions';

/**
 * The coupon resource: the codes a customer types.
 *
 * Two routes here are not CRUD. **`POST batch`** generates a mailing's worth of codes that share one
 * promotion, one window and one set of limits; it is all-or-nothing, because a list that quietly
 * comes back a thousand codes short is worse than a request that fails and is retried. **`POST
 * validate`** answers "may this code be used", with the reason it may not: a customer service agent
 * cannot act on "invalid code", and a customer is owed the difference between a code that expired
 * and a code that never existed.
 *
 * Validation never consumes anything. A redemption is taken by the checkout, under its own
 * conditional statement, so a code with one use left cannot be sold twice by two baskets that both
 * validated successfully.
 */
@ApiTags('Coupon')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.COUPONS_VIEW as PermissionsEnum)
@Controller('/coupons')
export class CouponController extends CrudController<Coupon> {
	constructor(private readonly couponService: CouponService) {
		super(couponService);
	}

	/**
	 * Generates a batch of codes in one request.
	 *
	 * @param entity The batch request: the shared coupon fields, how many codes, and the format.
	 * @returns The batch identifier and the counts.
	 */
	@ApiOperation({ summary: 'Generate a batch of coupon codes' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Batch generated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The count is out of range' })
	@Permissions(PromotionPermission.COUPONS_CREATE as PermissionsEnum)
	@Post('batch')
	async createBatch(
		@Body() entity: CreateCouponDTO & { count: number; couponCodeFormat?: ICouponCodeFormat }
	): Promise<ICouponBatchResult> {
		return this.couponService.createBatch(entity as never);
	}

	/**
	 * Validates a code against a basket without applying it.
	 *
	 * @param body The code presented, and the basket and customer it is being checked against.
	 * @returns Whether the code may be used, the coupon when it may, and why not when it may not.
	 */
	@ApiOperation({ summary: 'Validate a coupon code' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Validation answered' })
	@Permissions(PromotionPermission.COUPONS_VIEW as PermissionsEnum)
	@Post('validate')
	@HttpCode(HttpStatus.OK)
	async validate(
		@Body() body: { code: string; cartId?: ID; customerId?: ID }
	): Promise<{ valid: boolean; coupon?: ICoupon; reason?: string }> {
		return this.couponService.validate(body?.code, {
			customerId: body?.customerId
		});
	}

	/**
	 * Creates one coupon.
	 *
	 * The code is normalised to upper case before the uniqueness check, so `save10` and `SAVE10`
	 * cannot both exist in one organization.
	 *
	 * @param entity The coupon to create.
	 * @returns The stored coupon.
	 */
	@ApiOperation({ summary: 'Create a coupon' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Coupon created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The code is empty or already used' })
	@Permissions(PromotionPermission.COUPONS_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCouponDTO): Promise<ICoupon> {
		return this.couponService.createCoupon(entity as never);
	}

	/**
	 * Changes a coupon's promotion, window or limits.
	 *
	 * @param id The coupon to change.
	 * @param entity The fields to change.
	 * @returns The stored coupon.
	 */
	@ApiOperation({ summary: 'Update a coupon' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Coupon updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Coupon not found' })
	@Permissions(PromotionPermission.COUPONS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateCouponDTO): Promise<ICoupon> {
		await this.couponService.update(id, entity as never);

		return this.couponService.findCouponOrFail(id);
	}

	/**
	 * Deletes a coupon.
	 *
	 * @param id The coupon to delete.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a coupon' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Coupon deleted' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Coupon not found' })
	@Permissions(PromotionPermission.COUPONS_DELETE as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<unknown> {
		return this.couponService.delete(id);
	}
}
