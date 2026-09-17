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
		return this.paymentProviderService.findProviders({
			where: { ...((filter ?? {}) as Record<string, unknown>) }
		});
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
}
