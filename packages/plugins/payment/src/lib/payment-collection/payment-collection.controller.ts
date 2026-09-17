import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Permissions,
	PermissionGuard,
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
		return this.paymentCollectionService.findCollections({
			where: { ...((filter ?? {}) as Record<string, unknown>) }
		});
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
}
