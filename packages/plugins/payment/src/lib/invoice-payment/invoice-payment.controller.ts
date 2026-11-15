import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Req,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '@gauzy/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe,
	allowedEmailLinkOrigins,
	isAllowedEmailLink
} from '@gauzy/core';
import { PaymentPermission } from '../payment.permissions';
import {
	IInvoicePayOption,
	IInvoicePaymentConnection,
	IInvoicePaymentConnectionWithSecret,
	InvoicePaymentService
} from './invoice-payment.service';

/** What an organization's settings write to connect its payment connector. */
export class InvoicePaymentConnectionDTO {
	@ApiProperty({ type: () => String, description: 'The HTTPS endpoint of the connector that opens checkouts.' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(2048)
	readonly checkoutEndpoint: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isEnabled?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTestMode?: boolean;
}

/** Where the provider sends the client back once they paid or gave up. */
export class InvoiceCheckoutDTO {
	@ApiProperty({
		type: () => String,
		description: 'The public page of the invoice, on a front end of this deployment.'
	})
	@IsNotEmpty()
	@IsString()
	@MaxLength(2048)
	readonly returnUrl: string;
}

/**
 * The public routes of paying an invoice online: what the invoice's public page asks, and where the organization's
 * payment connector posts its notifications. None needs an account: the page holds the invoice's share link, and the
 * connector signs its notifications.
 */
@ApiTags('InvoicePayment')
@Public()
@Controller('/public/invoice-payments')
export class PublicInvoicePaymentController {
	constructor(private readonly invoicePaymentService: InvoicePaymentService) {}

	@ApiOperation({ summary: 'Whether the public page of an invoice offers to pay it online, and for how much' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The pay option' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The link does not open the invoice' })
	@Get('invoice/:id/:token')
	async payOption(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('token') token: string
	): Promise<IInvoicePayOption> {
		return this.invoicePaymentService.payOptionOf(id, token);
	}

	@ApiOperation({ summary: 'Open a checkout for what is still due on an invoice' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Where the client pays' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The link does not open the invoice' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The invoice cannot be paid online' })
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@Post('invoice/:id/:token/checkout')
	@UseValidationPipe({ whitelist: true })
	async checkout(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('token') token: string,
		@Body() body: InvoiceCheckoutDTO
	): Promise<{ url: string }> {
		// The provider sends the client back here: only to a front end of this deployment, never to a page of the caller's
		if (!isAllowedEmailLink(body.returnUrl, allowedEmailLinkOrigins())) {
			throw new BadRequestException('INVOICE_PAYMENT_RETURN_URL_INVALID');
		}
		return this.invoicePaymentService.startCheckout(id, token, body.returnUrl);
	}

	@ApiOperation({ summary: "Receive a payment connector's signed notification" })
	@ApiResponse({ status: HttpStatus.OK, description: 'The notification was received' })
	@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'The notification is not signed by the connector' })
	@HttpCode(HttpStatus.OK)
	@Post(':providerId/notifications')
	async notification(
		@Param('providerId', UUIDValidationPipe) providerId: ID,
		@Req() request: { headers: Record<string, string | string[] | undefined>; rawBody?: Buffer }
	): Promise<{ received: true; duplicate?: boolean }> {
		return this.invoicePaymentService.receiveNotification(providerId, request.headers, request.rawBody);
	}
}

/**
 * The organization's connection to its payment connector, for its settings: the endpoint that opens checkouts, and
 * the signing secret the connector needs, shown when the connection is made and when it is rotated, never after.
 */
@ApiTags('InvoicePayment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
@Controller('/invoice-payments/connection')
export class InvoicePaymentConnectionController {
	constructor(private readonly invoicePaymentService: InvoicePaymentService) {}

	@ApiOperation({ summary: "The organization's connection to its payment connector" })
	@ApiResponse({ status: HttpStatus.OK, description: 'The connection, without its secret' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
	@Get()
	async connection(): Promise<IInvoicePaymentConnection> {
		return this.invoicePaymentService.connection();
	}

	@ApiOperation({ summary: 'Connect the organization to its payment connector, or change the connection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The connection; with its secret the first time' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_EDIT as PermissionsEnum)
	@Put()
	@UseValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
	async connect(
		@Body() body: InvoicePaymentConnectionDTO
	): Promise<IInvoicePaymentConnection | IInvoicePaymentConnectionWithSecret> {
		return this.invoicePaymentService.connect(body);
	}

	@ApiOperation({ summary: 'Give the connector a new signing secret; the previous one stops being accepted' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The connection with its new secret' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_EDIT as PermissionsEnum)
	@HttpCode(HttpStatus.OK)
	@Post('rotate-secret')
	async rotateSecret(): Promise<IInvoicePaymentConnectionWithSecret> {
		return this.invoicePaymentService.rotateSecret();
	}
}
