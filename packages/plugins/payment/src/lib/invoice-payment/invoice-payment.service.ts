import { randomUUID } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { environment } from '@gauzy/config';
import { ID, InvoiceStatusTypesEnum, PaymentMethodEnum } from '@gauzy/contracts';
import {
	Invoice,
	Payment,
	RequestContext,
	TokenPurposeEnum,
	createSsrfSafeHttpsAgent,
	verifyPurposeToken
} from '@gauzy/core';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { PaymentProvider } from '../payment-provider/payment-provider.entity';
import { PaymentProviderService } from '../payment-provider/payment-provider.service';
import { TypeOrmPaymentProviderRepository } from '../payment-provider/repository/type-orm-payment-provider.repository';
import { PaymentWebhookEventService } from '../payment-webhook-event/payment-webhook-event.service';
import { IPaymentProvider, PaymentWebhookEventStatus } from '../payment.types';
import {
	IInvoicePaymentNotification,
	InvoicePaymentOutcome,
	SIGNED_CHECKOUT_PROVIDER_CODE,
	amountDueOf,
	confirmedAmountOf,
	isPayable,
	readNotification,
	standingAfterPayments,
	standingMayChange
} from './invoice-payment.rules';
import {
	PAYMENT_SIGNATURE_HEADER,
	SigningKeySource,
	isSignedBy,
	signedHeaders,
	signingKeySourceOf,
	signingSecretOf
} from './invoice-payment-signature';

/** What the public page of an invoice is told about paying it. */
export interface IInvoicePayOption {
	/** Whether the page offers Pay: the organization connected a payment provider and something is left to pay. */
	payable: boolean;
	amountDue: string | null;
	currency: string | null;
}

/** The connection of an organization's payment connector, as its settings show it. Never carries the secret. */
export interface IInvoicePaymentConnection {
	connected: boolean;
	isEnabled: boolean;
	isTestMode: boolean;
	checkoutEndpoint: string | null;
	/** Where the connector posts its notifications. */
	notificationUrl: string | null;
}

/** The connection right after it was made or its secret rotated: the only answer that carries the secret. */
export interface IInvoicePaymentConnectionWithSecret extends IInvoicePaymentConnection {
	signingSecret: string;
}

/** What an organization's settings write. */
export interface IInvoicePaymentConnectionInput {
	checkoutEndpoint: string;
	isEnabled?: boolean;
	isTestMode?: boolean;
}

/** What a provider registration of a payment connector holds in its (non-secret) configuration. */
interface IConnectorConfiguration {
	checkoutEndpoint?: string;
	signingKeyVersion?: number;
	signingKeySource?: SigningKeySource;
}

/**
 * The notifications the callback log keeps open until they are applied: a payment that succeeded is recorded, and a
 * failed or cancelled one changes nothing. Any other type is logged as ignored.
 */
const CONNECTOR_EVENT_MAP: Record<string, string> = {
	[InvoicePaymentOutcome.SUCCEEDED]: 'invoice-payment.record',
	[InvoicePaymentOutcome.FAILED]: 'invoice-payment.none',
	[InvoicePaymentOutcome.CANCELED]: 'invoice-payment.none'
};

/** The longest a checkout request may take, in milliseconds. */
const CHECKOUT_TIMEOUT_MS = 10_000;
/** The largest checkout answer read, in bytes: it only carries a URL and an id. */
const CHECKOUT_ANSWER_MAX_BYTES = 16 * 1024;

/**
 * Pays an invoice online through the organization's payment connector (ever-co/ever-gauzy#11856).
 *
 * - The public page of an invoice asks whether it may offer Pay, and opens a checkout: the amount is the one still
 *   due, computed here from the invoice and its payments, never taken from the browser.
 * - The connector, a small service the organization runs next to its payment provider, opens the provider's checkout
 *   and, once the provider confirms the payment, posts a signed notification. The API records the payment against
 *   the invoice and sets it Paid, Partially paid or Overpaid. A failed or cancelled payment changes nothing.
 * - Both messages are signed with a secret derived from the API's own key (`invoice-payment-signature.ts`): the
 *   provider's keys stay with the connector, no card data reaches the API, and a forged notification is refused.
 *
 * The registration is a `payment_provider` row of code `signed-checkout` in the invoice's organization.
 */
@Injectable()
export class InvoicePaymentService {
	private readonly logger = new Logger(InvoicePaymentService.name);
	private agent?: ReturnType<typeof createSsrfSafeHttpsAgent>;

	constructor(
		@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
		@InjectRepository(Payment) private readonly payments: Repository<Payment>,
		private readonly typeOrmPaymentProviderRepository: TypeOrmPaymentProviderRepository,
		private readonly paymentProviderService: PaymentProviderService,
		private readonly paymentWebhookEventService: PaymentWebhookEventService
	) {}

	/*
	|--------------------------------------------------------------------------
	| The public page
	|--------------------------------------------------------------------------
	*/

	/**
	 * Whether the public page of an invoice offers Pay, and for how much.
	 *
	 * @throws ForbiddenException when the link does not open the invoice (revoked, voided, or not its own).
	 */
	async payOptionOf(invoiceId: ID, token: string): Promise<IInvoicePayOption> {
		const invoice = await this.invoiceOfLink(invoiceId, token);
		const amountDue = amountDueOf(invoice, await this.paymentsOf(invoice));
		const provider = await this.connectorOf(invoice);
		return {
			payable: Boolean(provider) && isPayable(invoice, amountDue),
			amountDue: amountDue?.amount ?? null,
			currency: amountDue?.currency ?? invoice.currency ?? null
		};
	}

	/**
	 * Opens a checkout for what is still due on an invoice, and answers where the client pays it.
	 *
	 * @param returnUrl Where the provider sends the client back: the public page, on a front end this deployment serves.
	 * @throws ForbiddenException when the link does not open the invoice.
	 * @throws BadRequestException when the invoice cannot be paid online (nothing due, or no connector).
	 * @throws BadGatewayException when the connector did not answer with a checkout.
	 */
	async startCheckout(invoiceId: ID, token: string, returnUrl: string): Promise<{ url: string }> {
		const invoice = await this.invoiceOfLink(invoiceId, token);
		const amountDue = amountDueOf(invoice, await this.paymentsOf(invoice));
		const provider = await this.connectorOf(invoice);
		if (!provider || !isPayable(invoice, amountDue)) {
			throw new BadRequestException('INVOICE_NOT_PAYABLE_ONLINE');
		}
		const configuration = (provider.configuration ?? {}) as IConnectorConfiguration;
		const secret = this.secretOf(provider);
		if (!secret || !configuration.checkoutEndpoint) {
			this.logger.error(`The payment connector ${provider.id} cannot sign: its key is not on this API.`);
			throw new ServiceUnavailableException('INVOICE_PAYMENT_CONNECTOR_UNAVAILABLE');
		}
		const body = JSON.stringify({
			reference: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			amount: amountDue.amount,
			currency: amountDue.currency,
			returnUrl,
			isTestMode: Boolean(provider.isTestMode)
		});
		const answer = await this.postSigned(configuration.checkoutEndpoint, secret, body);
		const url = typeof answer?.['url'] === 'string' ? answer['url'] : null;
		if (!url || getUnsafeOutboundUrlReason(url) !== null) {
			throw new BadGatewayException('INVOICE_PAYMENT_CHECKOUT_FAILED');
		}
		return { url };
	}

	/*
	|--------------------------------------------------------------------------
	| The connector's notification
	|--------------------------------------------------------------------------
	*/

	/**
	 * Receives a connector's notification and applies it.
	 *
	 * Only a notification signed with the connector's secret is recorded: an unsigned one is refused before anything
	 * is written, so it can neither change an invoice nor take the id a real notification will carry. A notification
	 * delivered twice is acknowledged and applied once (`payment_webhook_event`'s replay key), and a payment is never
	 * recorded twice (`payment`'s unique provider and external id).
	 *
	 * @throws UnauthorizedException when the notification is not signed by the connector (forged, or too old).
	 * @throws BadRequestException when it is not a notification.
	 */
	async receiveNotification(
		providerId: ID,
		headers: Record<string, string | string[] | undefined>,
		rawBody: Buffer | undefined
	): Promise<{ received: true; duplicate?: boolean }> {
		const provider = await this.typeOrmPaymentProviderRepository.findOne({
			where: { id: providerId, code: SIGNED_CHECKOUT_PROVIDER_CODE, deletedAt: IsNull() } as never
		});
		const secret = provider ? this.secretOf(provider) : null;
		if (!provider || !secret || !isSignedBy(secret, headers, rawBody)) {
			this.logger.warn(`A payment notification for connector ${providerId} was refused: it is not signed by it.`);
			throw new UnauthorizedException('PAYMENT_WEBHOOK_SIGNATURE_INVALID');
		}
		const notification = readNotification(rawBody);
		if (!notification) {
			throw new BadRequestException('PAYMENT_WEBHOOK_PAYLOAD_INVALID');
		}
		const signature = String(headers[PAYMENT_SIGNATURE_HEADER] ?? '');
		return this.inScopeOf(provider, () => this.apply(provider, notification, rawBody, signature));
	}

	/** Records the notification on the callback log, then applies it unless it already was. */
	private async apply(
		provider: IPaymentProvider,
		notification: IInvoicePaymentNotification,
		rawBody: Buffer,
		signature: string
	): Promise<{ received: true; duplicate?: boolean }> {
		const { event, duplicate } = await this.paymentWebhookEventService.intake({
			providerId: provider.id,
			eventId: notification.eventId,
			type: notification.type,
			payload: JSON.parse(rawBody.toString('utf8')),
			signature,
			receivedAt: new Date()
		} as never);
		const settled = [PaymentWebhookEventStatus.PROCESSED, PaymentWebhookEventStatus.IGNORED];
		if (duplicate && settled.includes(event.status)) {
			return { received: true, duplicate: true };
		}
		try {
			const applied = await this.applyNotification(provider, notification);
			if (applied) {
				await this.paymentWebhookEventService.markProcessed(event.id);
			} else {
				await this.paymentWebhookEventService.markIgnored(event.id);
			}
			return { received: true };
		} catch (error) {
			// Kept as failed, so the connector's next delivery of the same notification applies it again
			await this.paymentWebhookEventService.markFailed(event.id, String(error?.message ?? error).slice(0, 500));
			throw error;
		}
	}

	/**
	 * Records a confirmed payment against its invoice, in one transaction that locks the invoice where the database
	 * locks rows: two notifications at once count each payment once in the invoice's standing.
	 *
	 * A payment taken in test mode, or by a connector in test mode, is never recorded: test money never settles an
	 * invoice. A payment that lands on a voided invoice is recorded against it, for the team to refund, and the invoice
	 * stays void.
	 *
	 * @returns Whether the notification changed something: false for a failed or cancelled payment, a test payment, or
	 * one recorded already.
	 * @throws BadRequestException when the payment cannot be recorded against the invoice it names.
	 */
	async applyNotification(provider: IPaymentProvider, notification: IInvoicePaymentNotification): Promise<boolean> {
		if (notification.outcome !== InvoicePaymentOutcome.SUCCEEDED) {
			return false;
		}
		if (notification.isTestMode || provider.isTestMode) {
			this.logger.log(
				`A test payment of connector ${provider.id} was received and not recorded against an invoice.`
			);
			return false;
		}
		return this.invoices.manager.transaction(async (manager: EntityManager) => {
			const invoice = await manager.findOne(Invoice, {
				where: {
					id: notification.reference,
					tenantId: provider.tenantId,
					organizationId: provider.organizationId
				},
				...this.rowLock(manager)
			});
			if (!invoice || invoice.isEstimate) {
				throw new BadRequestException('INVOICE_PAYMENT_UNKNOWN_INVOICE');
			}
			const amount = confirmedAmountOf(invoice, notification);
			if (!amount) {
				throw new BadRequestException('INVOICE_PAYMENT_AMOUNT_INVALID');
			}
			const recorded = await manager.findOne(Payment, {
				where: {
					paymentProviderId: provider.id,
					externalId: notification.paymentId,
					deletedAt: IsNull()
				} as never
			});
			if (recorded) {
				return false;
			}
			await manager.save(
				Payment,
				manager.create(Payment, {
					invoiceId: invoice.id,
					organizationContactId: invoice.toContactId ?? null,
					amount: amount.amount,
					currency: amount.currency,
					paymentDate: new Date(),
					paymentMethod: PaymentMethodEnum.ONLINE,
					paymentProviderId: provider.id,
					externalId: notification.paymentId,
					reference: notification.eventId,
					note: 'Paid online from the invoice link',
					tenantId: provider.tenantId,
					organizationId: provider.organizationId
				} as never)
			);
			const payments = await manager.find(Payment, {
				where: { invoiceId: invoice.id, tenantId: provider.tenantId, deletedAt: IsNull() } as never
			});
			if (!standingMayChange(invoice)) {
				this.logger.warn(
					`A payment landed on voided invoice ${invoice.id}: it is recorded for a refund, and the invoice stays void.`
				);
				return true;
			}
			const standing = standingAfterPayments(invoice, payments as never);
			if (standing) {
				await manager.update(Invoice, { id: invoice.id, tenantId: provider.tenantId }, {
					alreadyPaid: standing.alreadyPaid,
					amountDue: standing.amountDue,
					paid: standing.paid,
					status: standing.status
				} as never);
			}
			return true;
		});
	}

	/*
	|--------------------------------------------------------------------------
	| The organization's settings
	|--------------------------------------------------------------------------
	*/

	/** The connection of the caller's organization. */
	async connection(): Promise<IInvoicePaymentConnection> {
		return this.describe(await this.paymentProviderService.findProviderByCode(SIGNED_CHECKOUT_PROVIDER_CODE));
	}

	/**
	 * Connects the caller's organization to its payment connector, or changes the connection. The first connection
	 * answers the signing secret the connector needs; a later change keeps it.
	 *
	 * @throws BadRequestException when the endpoint is not a public HTTPS URL.
	 * @throws ServiceUnavailableException when the API has no key to derive a secret from.
	 */
	async connect(
		input: IInvoicePaymentConnectionInput
	): Promise<IInvoicePaymentConnection | IInvoicePaymentConnectionWithSecret> {
		const checkoutEndpoint = String(input?.checkoutEndpoint ?? '').trim();
		const unsafe = getUnsafeOutboundUrlReason(checkoutEndpoint);
		if (unsafe !== null) {
			throw new BadRequestException(`INVOICE_PAYMENT_ENDPOINT_INVALID: ${unsafe}`);
		}
		const existing = await this.paymentProviderService.findProviderByCode(SIGNED_CHECKOUT_PROVIDER_CODE);
		if (existing) {
			// Only what the settings own: the signing version stays what a rotation at the same moment wrote
			const updated = await this.updateConnector(existing.id, () => ({
				...(input.isEnabled === undefined ? {} : { isEnabled: input.isEnabled }),
				...(input.isTestMode === undefined ? {} : { isTestMode: input.isTestMode }),
				configuration: { checkoutEndpoint, eventMap: CONNECTOR_EVENT_MAP }
			}));
			return this.describe(updated);
		}
		const source = this.keySourceOrFail();
		const created = await this.paymentProviderService.createProvider({
			code: SIGNED_CHECKOUT_PROVIDER_CODE,
			name: 'Invoice payments',
			isEnabled: input.isEnabled ?? true,
			isTestMode: input.isTestMode ?? false,
			configuration: {
				checkoutEndpoint,
				eventMap: CONNECTOR_EVENT_MAP,
				signingKeyVersion: 1,
				signingKeySource: source
			}
		} as never);
		return { ...this.describe(created), signingSecret: this.secretOf(created) };
	}

	/**
	 * Gives the caller's organization's connector a new signing secret: the previous one stops being accepted at once.
	 *
	 * @throws BadRequestException when the organization has no connector.
	 */
	async rotateSecret(): Promise<IInvoicePaymentConnectionWithSecret> {
		const existing = await this.paymentProviderService.findProviderByCode(SIGNED_CHECKOUT_PROVIDER_CODE);
		if (!existing) {
			throw new BadRequestException('INVOICE_PAYMENT_NOT_CONNECTED');
		}
		const signingKeySource = this.keySourceOrFail();
		// The version is raised from the one read under the lock: two rotations at once give two versions
		const updated = await this.updateConnector(existing.id, (configuration) => ({
			configuration: { signingKeyVersion: (configuration.signingKeyVersion ?? 0) + 1, signingKeySource }
		}));
		return { ...this.describe(updated), signingSecret: this.secretOf(updated) };
	}

	/*
	|--------------------------------------------------------------------------
	| Helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * The invoice a public link opens: a share token of that invoice, equal to its stored one, of a sent invoice that is
	 * not voided. The same rule as the public read of the invoice.
	 */
	private async invoiceOfLink(invoiceId: ID, token: string): Promise<Invoice> {
		let tenantId: ID;
		try {
			const decoded = verifyPurposeToken<{ id: string; tenantId: string }>(
				token,
				TokenPurposeEnum.INVOICE_SHARE,
				{
					requiredClaims: ['id', 'tenantId'],
					allowLegacyUntyped: true
				}
			);
			if (decoded.id !== invoiceId) {
				throw new ForbiddenException();
			}
			tenantId = decoded.tenantId;
		} catch {
			throw new ForbiddenException();
		}
		const invoice = await this.invoices.findOne({ where: { id: invoiceId, token, tenantId } });
		if (!invoice || invoice.status === InvoiceStatusTypesEnum.VOID) {
			throw new ForbiddenException();
		}
		return invoice;
	}

	/** The payments recorded against an invoice. */
	private async paymentsOf(invoice: Invoice): Promise<Payment[]> {
		return this.payments.find({
			where: { invoiceId: invoice.id, tenantId: invoice.tenantId, deletedAt: IsNull() } as never
		});
	}

	/** The enabled payment connector of the invoice's organization, or null. */
	private async connectorOf(invoice: Invoice): Promise<PaymentProvider | null> {
		return this.typeOrmPaymentProviderRepository.findOne({
			where: {
				tenantId: invoice.tenantId,
				organizationId: invoice.organizationId,
				code: SIGNED_CHECKOUT_PROVIDER_CODE,
				isEnabled: true,
				deletedAt: IsNull()
			} as never
		});
	}

	/**
	 * Changes a connector of the caller's organization: its row is read and written in one transaction that locks it
	 * where the database locks rows (Postgres, MySQL; SQLite runs one transaction at a time), and only the fields the
	 * change names are written. A settings save and a secret rotation at the same moment each keep what the other wrote.
	 *
	 * @throws NotFoundException when the organization has no such connector.
	 */
	private async updateConnector(
		id: ID,
		change: (configuration: IConnectorConfiguration) => {
			isEnabled?: boolean;
			isTestMode?: boolean;
			configuration: Partial<IConnectorConfiguration> & Record<string, unknown>;
		}
	): Promise<IPaymentProvider> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		return this.typeOrmPaymentProviderRepository.manager.transaction(async (manager: EntityManager) => {
			const current = await manager.findOne(PaymentProvider, {
				where: { id, tenantId, organizationId, code: SIGNED_CHECKOUT_PROVIDER_CODE } as never,
				...this.rowLock(manager)
			});
			if (!current) {
				throw new NotFoundException('PAYMENT_PROVIDER_NOT_FOUND');
			}
			const configuration = (current.configuration ?? {}) as IConnectorConfiguration & Record<string, unknown>;
			const { configuration: changed, ...fields } = change(configuration);
			await manager.update(
				PaymentProvider,
				{ id: current.id, tenantId, organizationId } as never,
				{
					...fields,
					configuration: { ...configuration, ...changed }
				} as never
			);
			return manager.findOne(PaymentProvider, { where: { id: current.id, tenantId, organizationId } as never });
		});
	}

	/** The signing secret of a connector, or null when this API does not hold the key it is derived from. */
	private secretOf(provider: IPaymentProvider): string | null {
		const configuration = (provider.configuration ?? {}) as IConnectorConfiguration;
		const source = configuration.signingKeySource;
		const version = Number(configuration.signingKeyVersion);
		return source ? signingSecretOf(provider.id, version, source) : null;
	}

	/** The key a new secret is derived from. @throws ServiceUnavailableException when the API has none it may use. */
	private keySourceOrFail(): SigningKeySource {
		const source = signingKeySourceOf();
		if (!source) {
			throw new ServiceUnavailableException(
				'INVOICE_PAYMENT_KEY_MISSING: set ENCRYPTION_KEY (a base64-encoded 32-byte key) on the API to connect a payment provider.'
			);
		}
		return source;
	}

	/** The connection as its settings show it. */
	private describe(provider: IPaymentProvider | null): IInvoicePaymentConnection {
		const configuration = (provider?.configuration ?? {}) as IConnectorConfiguration;
		return {
			connected: Boolean(provider),
			isEnabled: Boolean(provider?.isEnabled),
			isTestMode: Boolean(provider?.isTestMode),
			checkoutEndpoint: configuration.checkoutEndpoint ?? null,
			notificationUrl: provider
				? `${environment.baseUrl}/api/public/invoice-payments/${provider.id}/notifications`
				: null
		};
	}

	/** A row lock for the invoice where the database locks rows (Postgres, MySQL); SQLite locks none. */
	private rowLock(manager: EntityManager): { lock?: { mode: 'pessimistic_write' } } {
		const type = manager.connection.options.type;
		return type === 'postgres' || type === 'mysql' || type === 'mariadb'
			? { lock: { mode: 'pessimistic_write' } }
			: {};
	}

	/**
	 * Runs `fn` in a request context of the connector's tenant and organization: the notification comes on a public
	 * request, and the callback log is written in the caller's scope.
	 */
	private inScopeOf<T>(provider: IPaymentProvider, fn: () => Promise<T>): Promise<T> {
		const user = {
			id: undefined,
			tenantId: provider.tenantId,
			lastOrganizationId: provider.organizationId,
			name: 'Invoice payment',
			permissions: [] as never[]
		};
		const request = { user, headers: {}, query: {}, params: {}, body: {} };
		return RequestContext.runWithRequest(request as never, fn, { id: randomUUID() as ID });
	}

	/**
	 * Posts a signed body to the connector and reads its JSON answer, refusing private addresses and redirects. The
	 * answer is settled once, whatever happens: an error or an aborted reply, an answer past its size cap, or no
	 * complete answer within the deadline, all reject with 502.
	 */
	private postSigned(url: string, secret: string, body: string): Promise<Record<string, unknown> | null> {
		if (getUnsafeOutboundUrlReason(url) !== null) {
			return Promise.reject(new BadRequestException('INVOICE_PAYMENT_ENDPOINT_INVALID'));
		}
		this.agent ??= createSsrfSafeHttpsAgent();
		return new Promise((resolve, reject) => {
			let isSettled = false;
			let deadline: ReturnType<typeof setTimeout> | undefined;
			const settle = (outcome: () => void) => {
				if (isSettled) {
					return;
				}
				isSettled = true;
				clearTimeout(deadline);
				outcome();
			};
			const fail = (reason: string) =>
				settle(() => {
					this.logger.warn(`The payment connector's checkout failed: ${reason}`);
					call.destroy();
					reject(new BadGatewayException('INVOICE_PAYMENT_CHECKOUT_FAILED'));
				});
			const call = httpsRequest(
				url,
				{
					method: 'POST',
					agent: this.agent,
					timeout: CHECKOUT_TIMEOUT_MS,
					headers: {
						'content-type': 'application/json',
						'content-length': Buffer.byteLength(body),
						...signedHeaders(secret, body)
					}
				},
				(response) => {
					const chunks: Buffer[] = [];
					let size = 0;
					response.on('data', (chunk: Buffer) => {
						size += chunk.length;
						if (size > CHECKOUT_ANSWER_MAX_BYTES) {
							response.destroy();
							fail('the answer is too large');
							return;
						}
						chunks.push(chunk);
					});
					response.on('error', (error: Error) => fail(`the answer broke off (${error.message})`));
					response.on('aborted', () => fail('the answer was aborted'));
					response.on('end', () => {
						const status = response.statusCode ?? 0;
						if (status < 200 || status >= 300) {
							fail(`it answered ${status}`);
							return;
						}
						try {
							const answer = JSON.parse(Buffer.concat(chunks).toString('utf8'));
							settle(() => resolve(answer));
						} catch {
							fail('the answer is not JSON');
						}
					});
				}
			);
			// The socket timeout only covers silence: a reply that trickles in forever is cut at the deadline
			deadline = setTimeout(() => fail('no complete answer in time'), CHECKOUT_TIMEOUT_MS);
			call.on('timeout', () => fail('the connector went silent'));
			call.on('error', (error: Error) => fail(`it could not be reached (${error.message})`));
			call.end(body);
		});
	}
}
