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
import { PaymentCollection } from './payment-collection.entity';
import { PaymentCollectionService } from './payment-collection.service';
import { CreatePaymentCollectionDTO, UpdatePaymentCollectionDTO } from './dto';
import { IPaymentCollection } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * The money side of one order or cart.
 *
 * A collection is created with the amount that has to be collected and the order or cart it belongs
 * to; everything else about it is derived. Two consequences are visible in this file: the update DTO
 * carries no status member, and the service ignores one if a caller invents it, because the lifecycle
 * of a collection is a function of the money that moved against it — which is what makes "is this
 * order paid?" a question with one answer rather than two.
 *
 * Creating a collection is an authorisation act, so it carries `PAYMENT_SESSIONS_AUTHORIZE` rather
 * than an edit permission: nothing else on the platform creates one.
 */
@ApiTags('PaymentCollection')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
@Controller('/payment-collections')
export class PaymentCollectionController extends CrudController<PaymentCollection> {
	constructor(private readonly paymentCollectionService: PaymentCollectionService) {
		super(paymentCollectionService);
	}

	/**
	 * Lists the collections of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of collections.
	 */
	@ApiOperation({ summary: 'List payment collections' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Collections retrieved' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<PaymentCollection>): Promise<IPagination<IPaymentCollection>> {
		// The DTO is the find-options object, not a criterion, so it is spread whole. Nesting it under
		// `where` — which is what this route used to do — turns the DTO’s own members (`take`, `skip`,
		// `withDeleted`) into predicates on columns that do not exist, so every paged or soft-delete-aware
		// request answered `500 Property "take" was not found in "PaymentCollection"` while a bare read looked fine:
		// the query string this route advertises was unusable.
		return this.paymentCollectionService.findCollections({ ...(filter ?? {}) });
	}

	/**
	 * Reads one collection with the four amounts and the derived status.
	 *
	 * @param id The collection to read.
	 * @returns The collection.
	 */
	@ApiOperation({ summary: 'Find a payment collection by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Collection retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Collection not found' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentCollection> {
		return this.paymentCollectionService.findCollectionOrFail(id);
	}

	/**
	 * Creates the collection of an order or a cart.
	 *
	 * @param entity The collection to create.
	 * @returns The stored collection.
	 */
	@ApiOperation({ summary: 'Create a payment collection for an order or a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Collection created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No target, or a cart that already has one' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	// An order or a cart has one collection, and the service refuses a second one, so the key is
	// optional: a client that presents one is answered from the record rather than from the refusal.
	@Idempotent({ scope: 'payment.collection.create', required: false, resourceType: 'payment_collection' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreatePaymentCollectionDTO): Promise<IPaymentCollection> {
		return this.paymentCollectionService.createCollection(entity as never);
	}

	/**
	 * Changes the descriptive fields of a collection. Its amount and currency are refused once money
	 * has moved against it, because the sessions were created for that figure.
	 *
	 * @param id The collection to change.
	 * @param entity The fields to change.
	 * @returns The stored collection.
	 */
	@ApiOperation({ summary: 'Update a payment collection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Collection updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Collection not found' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdatePaymentCollectionDTO
	): Promise<IPaymentCollection> {
		return this.paymentCollectionService.updateCollection(id, entity as never);
	}

	/**
	 * Deletes a payment collection.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_SESSIONS_AUTHORIZE`, the grant the create and
	 * update routes here already carry.
	 *
	 * @param id The collection to delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully deleted' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a payment collection, leaving the row in place.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_SESSIONS_AUTHORIZE`, as the delete route this
	 * controller declares does.
	 *
	 * @param id The collection to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted collection.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a payment collection that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_SESSIONS_AUTHORIZE` — restoring is the same grant
	 * exercised backwards, and the delete and soft-delete routes here state it too.
	 *
	 * @param id The collection to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored collection.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
