import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { ReturnsFeatures } from '../returns.features';
import { ReturnsPermissions } from '../returns.permissions';
import { CreateOrderClaimLineDTO, UpdateOrderClaimLineDTO } from './dto';
import { OrderClaimLine } from './order-claim-line.entity';
import { OrderClaimLineService } from './order-claim-line.service';

/**
 * Claim lines.
 *
 * A claim may have two lines about the same order line — one damaged, one missing — which is why
 * there is no uniqueness constraint on the pair and no merged "adjust the quantity" endpoint: the
 * distinction between the two is what the resolution depends on.
 */
@ApiTags('OrderClaimLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.CLAIMS_VIEW)
@Controller('/order-claim-lines')
export class OrderClaimLineController extends CrudController<OrderClaimLine> {
	constructor(private readonly orderClaimLineService: OrderClaimLineService) {
		super(orderClaimLineService);
	}

	/**
	 * Lists claim lines.
	 *
	 * @param options The filter, including `filter[claimId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List claim lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<OrderClaimLine>): Promise<IPagination<OrderClaimLine>> {
		return await this.orderClaimLineService.findAll(options);
	}

	/**
	 * Adds a line to a claim that is still open.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add a line to a claim' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderClaimLineDTO): Promise<OrderClaimLine> {
		return await this.orderClaimLineService.create(entity as any);
	}

	/**
	 * Updates a claim line.
	 *
	 * @param id The line to update.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Update a claim line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderClaimLineDTO
	): Promise<OrderClaimLine> {
		await this.orderClaimLineService.update(id, entity as any);

		return await this.orderClaimLineService.findOneByIdString(id);
	}
}
