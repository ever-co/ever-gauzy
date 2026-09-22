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
import { PaymentProvider } from './payment-provider.entity';
import { PaymentProviderService } from './payment-provider.service';
import { CreatePaymentProviderDTO, UpdatePaymentProviderDTO } from './dto';
import { IPaymentProvider } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * The provider registry.
 *
 * A registration is a code, a label, an availability list and a link to the integration whose
 * settings hold the credentials — it is deliberately not a credential store, and the service refuses
 * a configuration that carries one.
 *
 * Deleting a registration is the generic delete and it fails loudly while sessions reference it: the
 * supported way to withdraw a provider is to disable it, so the payments it processed keep resolving
 * to the provider that processed them, and so a caller can be told `PAYMENT_PROVIDER_DISABLED`
 * instead of watching the provider disappear from the list.
 */
@ApiTags('PaymentProvider')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
@Controller('/payment-providers')
export class PaymentProviderController extends CrudController<PaymentProvider> {
	constructor(private readonly paymentProviderService: PaymentProviderService) {
		super(paymentProviderService);
	}

	/**
	 * Lists the registrations of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of registrations.
	 */
	@ApiOperation({ summary: 'List the payment provider registrations' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Providers retrieved' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<PaymentProvider>): Promise<IPagination<IPaymentProvider>> {
		// The DTO is the find-options object, not a criterion, so it is spread whole. Nesting it under
		// `where` — which is what this route used to do — turns the DTO’s own members (`take`, `skip`,
		// `withDeleted`) into predicates on columns that do not exist, so every paged or soft-delete-aware
		// request answered `500 Property "take" was not found in "PaymentProvider"` while a bare read looked fine:
		// the query string this route advertises was unusable.
		return this.paymentProviderService.findProviders({ ...(filter ?? {}) });
	}

	/**
	 * Lists the providers that may be offered to a buyer: enabled, in display order.
	 *
	 * @returns The offerable registrations.
	 */
	@ApiOperation({ summary: 'List the enabled payment providers, in display order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Providers retrieved' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
	@Get('enabled/list')
	async findEnabled(): Promise<IPaymentProvider[]> {
		return this.paymentProviderService.findEnabledProviders();
	}

	/**
	 * Reads one registration with its non-secret configuration.
	 *
	 * @param id The registration to read.
	 * @returns The registration.
	 */
	@ApiOperation({ summary: 'Find a payment provider by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Provider retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Provider not found' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentProvider> {
		return this.paymentProviderService.findProviderOrFail(id);
	}

	/**
	 * Registers a provider against an existing integration.
	 *
	 * The body is validated against the create DTO with the whitelist enforced, so a member the
	 * contract does not declare — a card number, a credential, anything else a caller invents — is
	 * refused rather than stored.
	 *
	 * @param entity The registration to create.
	 * @returns The stored registration.
	 */
	@ApiOperation({ summary: 'Register a payment provider' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Provider registered' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Code taken, or a credential in the configuration' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_CREATE as PermissionsEnum)
	// A registration is refused when the code is taken, which already makes a duplicate harmless, so the
	// key is optional: a client that presents one is answered from the record instead of being refused.
	@Idempotent({ scope: 'payment.provider.create', required: false, resourceType: 'payment_provider' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreatePaymentProviderDTO): Promise<IPaymentProvider> {
		return this.paymentProviderService.createProvider(entity as never);
	}

	/**
	 * Changes a registration. The code may not change: it is the key the adapter is resolved from.
	 *
	 * @param id The registration to change.
	 * @param entity The fields to change.
	 * @returns The stored registration.
	 */
	@ApiOperation({ summary: 'Update a payment provider' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Provider updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Provider not found' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdatePaymentProviderDTO
	): Promise<IPaymentProvider> {
		return this.paymentProviderService.updateProvider(id, entity as never);
	}

	/**
	 * Deletes a provider registration, which the service refuses while sessions reference it.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_PROVIDERS_DELETE`, the grant the GraphQL
	 * `deletePaymentProvider` mutation states for the same registration.
	 *
	 * @param id The registration to delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully deleted' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_DELETE as PermissionsEnum)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a provider registration.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_PROVIDERS_DELETE`, as the delete route this
	 * controller declares does.
	 *
	 * @param id The registration to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted registration.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_DELETE as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a provider registration that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_PROVIDERS_DELETE` — restoring is the same grant
	 * exercised backwards, and the delete and soft-delete routes here state it too.
	 *
	 * @param id The registration to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored registration.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_DELETE as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
