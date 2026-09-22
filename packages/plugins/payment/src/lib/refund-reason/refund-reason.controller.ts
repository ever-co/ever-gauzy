import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { RefundReason } from './refund-reason.entity';
import { RefundReasonService } from './refund-reason.service';
import { CreateRefundReasonDTO, UpdateRefundReasonDTO } from './dto';
import { IRefundReason } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * The governed refund reasons.
 *
 * A reason is what makes refund reporting groupable: without one, "why did we give 4 200 back last
 * quarter" is answered by reading free text. A reason is therefore maintained under `REFUNDS_CREATE`
 * — the catalogue defines that permission as "create a refund, cancel a pending refund, and maintain
 * the refund reasons", because the operator who gives money back is the one who knows why — while
 * reading them stays under `REFUNDS_VIEW`.
 *
 * The tree is at most two levels deep, checked by the service when a reason is created under a parent
 * and again when one is moved, and a reason that is finished with is deactivated rather than deleted:
 * the reporting that groups by it has to keep resolving.
 */
@ApiTags('RefundReason')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
@Controller('/refund-reasons')
export class RefundReasonController extends CrudController<RefundReason> {
	constructor(private readonly refundReasonService: RefundReasonService) {
		super(refundReasonService);
	}

	/**
	 * Lists the reasons of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of reasons.
	 */
	@ApiOperation({ summary: 'List refund reasons' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reasons retrieved' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<RefundReason>): Promise<IPagination<IRefundReason>> {
		// The DTO is the find-options object, not a criterion, so it is spread whole. Nesting it under
		// `where` — which is what this route used to do — turns the DTO’s own members (`take`, `skip`,
		// `withDeleted`) into predicates on columns that do not exist, so every paged or soft-delete-aware
		// request answered `500 Property "take" was not found in "RefundReason"` while a bare read looked fine:
		// the query string this route advertises was unusable.
		return this.refundReasonService.findReasons({ ...(filter ?? {}) });
	}

	/**
	 * Reads one reason.
	 *
	 * @param id The reason to read.
	 * @returns The reason.
	 */
	@ApiOperation({ summary: 'Find a refund reason by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reason retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reason not found' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IRefundReason> {
		return this.refundReasonService.findReasonOrFail(id);
	}

	/**
	 * Creates a reason, optionally under an existing one.
	 *
	 * @param entity The reason to create.
	 * @returns The stored reason.
	 */
	@ApiOperation({ summary: 'Create a refund reason' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Reason created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Code taken, or a third level requested' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	// A reason is refused when its code is taken, so the key is optional: a client that presents one is
	// answered from the record instead of being refused for a duplicate it did not intend.
	@Idempotent({ scope: 'refund.reason.create', required: false, resourceType: 'refund_reason' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreateRefundReasonDTO): Promise<IRefundReason> {
		return this.refundReasonService.createReason(entity as never);
	}

	/**
	 * Changes a reason: its label, its description, its parent or its active state. The code is
	 * immutable, because reports cite it.
	 *
	 * @param id The reason to change.
	 * @param entity The fields to change.
	 * @returns The stored reason.
	 */
	@ApiOperation({ summary: 'Update a refund reason' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reason updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reason not found' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateRefundReasonDTO
	): Promise<IRefundReason> {
		return this.refundReasonService.updateReason(id, entity as never);
	}

	/**
	 * Deactivates a reason that is no longer offered, keeping it for the refunds that cite it.
	 *
	 * @param id The reason to deactivate.
	 * @returns The stored reason.
	 */
	@ApiOperation({ summary: 'Deactivate a refund reason' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reason deactivated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reason not found' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Post(':id/deactivate')
	@HttpCode(HttpStatus.OK)
	async deactivate(@Param('id', UUIDValidationPipe) id: ID): Promise<IRefundReason> {
		return this.refundReasonService.deactivateReason(id);
	}

	/**
	 * Deletes a refund reason.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `REFUNDS_CREATE`, the grant the create, update and
	 * deactivate routes here carry and the one the GraphQL `deleteRefundReason` mutation states for the
	 * same reason.
	 *
	 * @param id The reason to delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully deleted' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a refund reason, leaving the refunds that cite it explainable.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `REFUNDS_CREATE`, as the delete route this controller
	 * declares does.
	 *
	 * @param id The reason to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted reason.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a refund reason that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `REFUNDS_CREATE` — restoring is the same grant exercised
	 * backwards, and the delete and soft-delete routes here state it too.
	 *
	 * @param id The reason to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored reason.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
