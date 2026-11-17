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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { InvoiceCheckoutDTO, InvoicePaymentConnectionDTO } from './dto';
import {
	IInvoicePayOption,
	IInvoicePaymentConnection,
	IInvoicePaymentConnectionWithSecret,
	InvoicePaymentService
} from './invoice-payment.service';

/**
 * Paying an invoice online: one controller, one surface.
 *
 * It serves the organization's settings and the invoice's public page alike, and what each caller may do is decided
 * by the guard and the permission on the route, never by a second controller: the class runs under the tenant and
 * permission guards and asks for `PAYMENT_PROVIDERS_VIEW`, each settings route states its own grant, and the three
 * routes that need no account say so on the route itself — `@Public()`, which both guards let through, and an empty
 * `@Permissions()`, which clears the class's grant (the permission guard reads the handler's list first).
 *
 * - **The organization's settings** (`invoice-payments/connection`): its connection to its payment connector — the
 *   endpoint that opens checkouts, and the signing secret the connector needs, shown when the connection is made and
 *   when it is rotated, never after.
 * - **The invoice's public page** (`public/invoice-payments/invoice/:id/:token`): whether it offers to pay, and the
 *   checkout. The page holds the invoice's share link, the same `:id/:token` pair as the core's public invoice.
 * - **The connector's notification** (`public/invoice-payments/:providerId/notifications`): a server-to-server call
 *   the connector signs over the raw body; the signature is its only credential.
 *
 * The prefix is spelled on each route rather than on `@Controller()` because the routes span two prefixes: the
 * settings sit under `invoice-payments`, and the public routes keep the `public/` share-link prefix the public page,
 * the README and every connector already registered (its notification URL) were given. None of them moves.
 */
@ApiTags('InvoicePayment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
@Controller()
export class InvoicePaymentController {
	constructor(private readonly invoicePaymentService: InvoicePaymentService) {}

	/*
	|--------------------------------------------------------------------------
	| The organization's settings
	|--------------------------------------------------------------------------
	*/

	@ApiOperation({ summary: "The organization's connection to its payment connector" })
	@ApiResponse({ status: HttpStatus.OK, description: 'The connection, without its secret' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_VIEW as PermissionsEnum)
	@Get('invoice-payments/connection')
	async connection(): Promise<IInvoicePaymentConnection> {
		return this.invoicePaymentService.connection();
	}

	@ApiOperation({ summary: 'Connect the organization to its payment connector, or change the connection' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The connection; with its secret the first time' })
	@Permissions(PaymentPermission.PAYMENT_PROVIDERS_EDIT as PermissionsEnum)
	@Put('invoice-payments/connection')
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
	@Post('invoice-payments/connection/rotate-secret')
	async rotateSecret(): Promise<IInvoicePaymentConnectionWithSecret> {
		return this.invoicePaymentService.rotateSecret();
	}

	/*
	|--------------------------------------------------------------------------
	| The invoice's public page, and the connector's notification
	|--------------------------------------------------------------------------
	*/

	@ApiOperation({ summary: 'Whether the public page of an invoice offers to pay it online, and for how much' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The pay option' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The link does not open the invoice' })
	@Public()
	@Permissions()
	@Get('public/invoice-payments/invoice/:id/:token')
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
	@Public()
	@Permissions()
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@Post('public/invoice-payments/invoice/:id/:token/checkout')
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
	@Public()
	@Permissions()
	@HttpCode(HttpStatus.OK)
	@Post('public/invoice-payments/:providerId/notifications')
	async notification(
		@Param('providerId', UUIDValidationPipe) providerId: ID,
		@Req() request: { headers: Record<string, string | string[] | undefined>; rawBody?: Buffer }
	): Promise<{ received: true; duplicate?: boolean }> {
		return this.invoicePaymentService.receiveNotification(providerId, request.headers, request.rawBody);
	}
}
