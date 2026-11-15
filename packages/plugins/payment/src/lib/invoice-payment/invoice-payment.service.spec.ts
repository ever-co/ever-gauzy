import { EventEmitter } from 'node:events';
import { request as httpsRequest } from 'node:https';
import '@gauzy/core';
import { BadGatewayException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { InvoiceStatusTypesEnum } from '@gauzy/contracts';
import { Invoice, Payment, RequestContext, TokenPurposeEnum, signPurposeToken } from '@gauzy/core';
import { PaymentWebhookEventStatus } from '../payment.types';
import { signedHeaders, signingSecretOf } from './invoice-payment-signature';
import { SIGNED_CHECKOUT_PROVIDER_CODE } from './invoice-payment.rules';
import { InvoicePaymentService } from './invoice-payment.service';

// The connector's HTTPS answer is played by hand: a reply that breaks off, or never ends
jest.mock('node:https', () => ({ ...jest.requireActual('node:https'), request: jest.fn() }));

/**
 * Paying an invoice online (ever-co/ever-gauzy#11856), with the repositories doubled in memory:
 *
 * - the public page is offered Pay for what is still due, computed here and never taken from the browser;
 * - a payment the connector confirms is recorded once and sets the invoice Paid or Partially paid;
 * - a forged notification is refused before anything is written, and a failed or cancelled payment changes nothing.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const PROVIDER_ID = '33333333-3333-4333-8333-333333333333';
const INVOICE_ID = '44444444-4444-4444-8444-444444444444';
const ENV_KEY = Buffer.alloc(32, 9).toString('base64');

function world(invoiceFields: Partial<Invoice> = {}) {
	const token = signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, {
		id: INVOICE_ID,
		organizationId: ORGANIZATION,
		tenantId: TENANT
	});
	const invoice = {
		id: INVOICE_ID,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		token,
		invoiceNumber: 42,
		isEstimate: false,
		status: InvoiceStatusTypesEnum.SENT,
		currency: 'EUR',
		totalValue: 100,
		toContactId: 'contact-1',
		...invoiceFields
	} as Invoice;
	const payments: Payment[] = [];
	const provider = {
		id: PROVIDER_ID,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		code: SIGNED_CHECKOUT_PROVIDER_CODE,
		isEnabled: true,
		isTestMode: false,
		configuration: {
			checkoutEndpoint: 'https://pay.example.com/checkout',
			signingKeyVersion: 1,
			signingKeySource: 'k'
		}
	};
	const updates: Array<Record<string, unknown>> = [];

	const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
		Object.entries(where).every(([key, value]) =>
			value && typeof value === 'object' ? row[key] === null || row[key] === undefined : row[key] === value
		);

	const manager = {
		connection: { options: { type: 'sqlite' } },
		findOne: jest.fn(async (entity: unknown, { where }: { where: Record<string, unknown> }) => {
			if (entity === Invoice) return matches(invoice as never, where) ? { ...invoice } : null;
			return (payments.find((payment) => matches(payment as never, where)) as never) ?? null;
		}),
		find: jest.fn(async () => payments.map((payment) => ({ ...payment }))),
		create: jest.fn((_entity: unknown, values: Record<string, unknown>) => ({ ...values })),
		save: jest.fn(async (_entity: unknown, row: Payment) => {
			payments.push(row);
			return row;
		}),
		update: jest.fn(async (_entity: unknown, _where: unknown, values: Record<string, unknown>) => {
			updates.push(values);
			Object.assign(invoice, values);
		})
	};
	const invoices = {
		manager: { transaction: jest.fn(async (work: (m: typeof manager) => unknown) => work(manager)) },
		findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
			matches(invoice as never, where) ? { ...invoice } : null
		)
	};
	const paymentRepository = { find: jest.fn(async () => payments.map((payment) => ({ ...payment }))) };
	const providerManager = {
		connection: { options: { type: 'sqlite' } },
		findOne: jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) =>
			matches(provider as never, where) ? { ...provider, configuration: { ...provider.configuration } } : null
		),
		update: jest.fn(async (_entity: unknown, _where: unknown, values: Record<string, unknown>) => {
			Object.assign(provider, values);
		})
	};
	const providers = {
		manager: {
			transaction: jest.fn(async (work: (m: typeof providerManager) => unknown) => work(providerManager))
		},
		findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
			matches(provider as never, where) ? { ...provider } : null
		)
	};
	const events: Array<{ id: string; status: PaymentWebhookEventStatus }> = [];
	const webhookEvents = {
		intake: jest.fn(async ({ eventId }: { eventId: string }) => {
			const existing = events.find((event) => event.id === eventId);
			if (existing) return { event: existing, duplicate: true };
			const event = { id: eventId, status: PaymentWebhookEventStatus.RECEIVED };
			events.push(event);
			return { event, duplicate: false };
		}),
		markProcessed: jest.fn(async (id: string) => {
			events.find((event) => event.id === id).status = PaymentWebhookEventStatus.PROCESSED;
		}),
		markIgnored: jest.fn(async (id: string) => {
			events.find((event) => event.id === id).status = PaymentWebhookEventStatus.IGNORED;
		}),
		markFailed: jest.fn(async (id: string) => {
			events.find((event) => event.id === id).status = PaymentWebhookEventStatus.FAILED;
		})
	};
	// The registration as a request read it earlier: a rotation may have changed the row since
	const staleProvider = { ...provider, configuration: { ...provider.configuration } };
	const providerService = {
		findProviderByCode: jest.fn(async () => staleProvider),
		createProvider: jest.fn()
	};
	const service = new InvoicePaymentService(
		invoices as never,
		paymentRepository as never,
		providers as never,
		providerService as never,
		webhookEvents as never
	);
	return { service, invoice, token, payments, provider, updates, webhookEvents, manager, staleProvider };
}

/** A notification of the connector, signed with its secret unless another one is given. */
function notification(data: Record<string, unknown>, options: { id?: string; type?: string; secret?: string } = {}) {
	const body = JSON.stringify({
		id: options.id ?? 'evt_1',
		type: options.type ?? 'payment.succeeded',
		data: { reference: INVOICE_ID, paymentId: 'pay_1', currency: 'EUR', isTestMode: false, ...data }
	});
	const secret = options.secret ?? (signingSecretOf(PROVIDER_ID, 1, 'k', { ENCRYPTION_KEY: ENV_KEY }) as string);
	return { headers: signedHeaders(secret, body), rawBody: Buffer.from(body) };
}

describe('InvoicePaymentService', () => {
	const savedKey = process.env['ENCRYPTION_KEY'];
	beforeEach(() => {
		process.env['ENCRYPTION_KEY'] = ENV_KEY;
	});
	afterEach(() => {
		if (savedKey === undefined) delete process.env['ENCRYPTION_KEY'];
		else process.env['ENCRYPTION_KEY'] = savedKey;
		jest.restoreAllMocks();
	});

	describe('the public page', () => {
		it('offers Pay for what is still due', async () => {
			const { service, token, payments } = world();
			payments.push({ amount: 30, currency: 'EUR' } as Payment);

			await expect(service.payOptionOf(INVOICE_ID, token)).resolves.toEqual({
				payable: true,
				amountDue: '70',
				currency: 'EUR'
			});
		});

		it('offers no Pay when the organization has no connector', async () => {
			const { service, token, provider } = world();
			provider.isEnabled = false;

			await expect(service.payOptionOf(INVOICE_ID, token)).resolves.toMatchObject({ payable: false });
		});

		it("refuses a voided invoice's link, and another invoice's token", async () => {
			const voided = world({ status: InvoiceStatusTypesEnum.VOID });
			await expect(voided.service.payOptionOf(INVOICE_ID, voided.token)).rejects.toBeInstanceOf(
				ForbiddenException
			);

			const other = world();
			const foreign = signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, {
				id: '55555555-5555-4555-8555-555555555555',
				organizationId: ORGANIZATION,
				tenantId: TENANT
			});
			await expect(other.service.payOptionOf(INVOICE_ID, foreign)).rejects.toBeInstanceOf(ForbiddenException);
		});

		it('opens a checkout for the amount due, computed here, and answers where to pay', async () => {
			const { service, token, payments } = world();
			payments.push({ amount: 40, currency: 'EUR' } as Payment);
			const post = jest
				.spyOn(service as never, 'postSigned')
				.mockResolvedValue({ url: 'https://pay.example.com/c/abc', id: 'cs_1' } as never);

			await expect(
				service.startCheckout(INVOICE_ID, token, 'https://app.ever.team/#/share/invoices/x/y')
			).resolves.toEqual({ url: 'https://pay.example.com/c/abc' });

			const [endpoint, secret, body] = post.mock.calls[0] as unknown as [string, string, string];
			expect(endpoint).toBe('https://pay.example.com/checkout');
			expect(secret).toBe(signingSecretOf(PROVIDER_ID, 1, 'k', { ENCRYPTION_KEY: ENV_KEY }));
			expect(JSON.parse(body)).toMatchObject({ reference: INVOICE_ID, amount: '60', currency: 'EUR' });
		});

		it('refuses a checkout for an invoice paid in full', async () => {
			const { service, token, payments } = world();
			payments.push({ amount: 100, currency: 'EUR' } as Payment);

			await expect(service.startCheckout(INVOICE_ID, token, 'https://app.ever.team/')).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it('refuses a checkout page that is not a public HTTPS address', async () => {
			const { service, token } = world();
			jest.spyOn(service as never, 'postSigned').mockResolvedValue({ url: 'javascript:alert(1)' } as never);

			await expect(service.startCheckout(INVOICE_ID, token, 'https://app.ever.team/')).rejects.toBeInstanceOf(
				BadGatewayException
			);
		});
	});

	describe("the connector's notification", () => {
		it('records a payment the provider confirmed and sets the invoice Paid', async () => {
			const { service, payments, invoice, webhookEvents } = world();
			const { headers, rawBody } = notification({ amount: '100.00' });

			await expect(service.receiveNotification(PROVIDER_ID, headers, rawBody)).resolves.toEqual({
				received: true
			});

			expect(payments).toHaveLength(1);
			expect(payments[0]).toMatchObject({
				invoiceId: INVOICE_ID,
				amount: '100',
				currency: 'EUR',
				paymentProviderId: PROVIDER_ID,
				externalId: 'pay_1',
				tenantId: TENANT,
				organizationId: ORGANIZATION
			});
			expect(invoice).toMatchObject({ status: InvoiceStatusTypesEnum.FULLY_PAID, paid: true, amountDue: '0' });
			expect(webhookEvents.markProcessed).toHaveBeenCalledWith('evt_1');
		});

		it('sets the invoice Partially paid for a part of it', async () => {
			const { service, invoice } = world();
			const { headers, rawBody } = notification({ amount: '25' });

			await service.receiveNotification(PROVIDER_ID, headers, rawBody);

			expect(invoice).toMatchObject({
				status: InvoiceStatusTypesEnum.PARTIALLY_PAID,
				paid: false,
				alreadyPaid: '25',
				amountDue: '75'
			});
		});

		it('refuses a forged notification before anything is written — CONTROL: the same body signed is applied', async () => {
			const forged = world();
			const { headers, rawBody } = notification({ amount: '100' }, { secret: 'gzips_not-the-connector' });

			await expect(forged.service.receiveNotification(PROVIDER_ID, headers, rawBody)).rejects.toBeInstanceOf(
				UnauthorizedException
			);
			expect(forged.webhookEvents.intake).not.toHaveBeenCalled();
			expect(forged.payments).toHaveLength(0);
			expect(forged.invoice.status).toBe(InvoiceStatusTypesEnum.SENT);

			const control = world();
			const signed = notification({ amount: '100' });
			await control.service.receiveNotification(PROVIDER_ID, signed.headers, signed.rawBody);
			expect(control.payments).toHaveLength(1);
		});

		it('refuses a notification for a connector that does not exist', async () => {
			const { service } = world();
			const { headers, rawBody } = notification({ amount: '100' });

			await expect(
				service.receiveNotification('66666666-6666-4666-8666-666666666666', headers, rawBody)
			).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('records a notification delivered twice once', async () => {
			const { service, payments, invoice } = world();
			const first = notification({ amount: '25' });

			await service.receiveNotification(PROVIDER_ID, first.headers, first.rawBody);
			await expect(service.receiveNotification(PROVIDER_ID, first.headers, first.rawBody)).resolves.toEqual({
				received: true,
				duplicate: true
			});

			expect(payments).toHaveLength(1);
			expect(invoice.alreadyPaid).toBe('25');
		});

		it('records a payment once even under another notification id (the provider payment id is the key)', async () => {
			const { service, payments } = world();
			const first = notification({ amount: '25' }, { id: 'evt_1' });
			const second = notification({ amount: '25' }, { id: 'evt_2' });

			await service.receiveNotification(PROVIDER_ID, first.headers, first.rawBody);
			await service.receiveNotification(PROVIDER_ID, second.headers, second.rawBody);

			expect(payments).toHaveLength(1);
		});

		it.each(['payment.failed', 'payment.canceled'])('changes nothing for a %s', async (type) => {
			const { service, payments, invoice, webhookEvents } = world();
			const { headers, rawBody } = notification({ amount: '100' }, { type });

			await service.receiveNotification(PROVIDER_ID, headers, rawBody);

			expect(payments).toHaveLength(0);
			expect(invoice.status).toBe(InvoiceStatusTypesEnum.SENT);
			expect(webhookEvents.markIgnored).toHaveBeenCalledWith('evt_1');
		});

		it('keeps a payment in another currency as failed, and records nothing', async () => {
			const { service, payments, webhookEvents } = world();
			const { headers, rawBody } = notification({ amount: '100', currency: 'USD' });

			await expect(service.receiveNotification(PROVIDER_ID, headers, rawBody)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(payments).toHaveLength(0);
			expect(webhookEvents.markFailed).toHaveBeenCalledWith('evt_1', expect.any(String));
		});

		it('applies again a notification whose first delivery failed', async () => {
			const { service, payments, manager } = world();
			const { headers, rawBody } = notification({ amount: '100' });
			manager.save.mockRejectedValueOnce(new Error('connection reset'));

			await expect(service.receiveNotification(PROVIDER_ID, headers, rawBody)).rejects.toThrow(
				'connection reset'
			);
			await expect(service.receiveNotification(PROVIDER_ID, headers, rawBody)).resolves.toEqual({
				received: true
			});

			expect(payments).toHaveLength(1);
		});

		it("never records a payment against another organization's invoice", async () => {
			const { service, payments, invoice } = world();
			invoice.organizationId = '77777777-7777-4777-8777-777777777777';
			const { headers, rawBody } = notification({ amount: '100' });

			await expect(service.receiveNotification(PROVIDER_ID, headers, rawBody)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(payments).toHaveLength(0);
		});
	});
});

describe('InvoicePaymentService — review of #11996 (Greptile)', () => {
	const savedKey = process.env['ENCRYPTION_KEY'];
	beforeEach(() => {
		process.env['ENCRYPTION_KEY'] = ENV_KEY;
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
	});
	afterEach(() => {
		if (savedKey === undefined) delete process.env['ENCRYPTION_KEY'];
		else process.env['ENCRYPTION_KEY'] = savedKey;
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	it('records a payment that lands on a voided invoice, and keeps the invoice void', async () => {
		const { service, payments, invoice } = world({ status: InvoiceStatusTypesEnum.VOID });
		const { headers, rawBody } = notification({ amount: '100' });

		await service.receiveNotification(PROVIDER_ID, headers, rawBody);

		expect(payments).toHaveLength(1);
		expect(invoice.status).toBe(InvoiceStatusTypesEnum.VOID);
		expect(invoice.alreadyPaid).toBeUndefined();
	});

	it('never records a payment taken in test mode', async () => {
		const { service, payments, invoice, webhookEvents } = world();
		const { headers, rawBody } = notification({ amount: '100', isTestMode: true });

		await service.receiveNotification(PROVIDER_ID, headers, rawBody);

		expect(payments).toHaveLength(0);
		expect(invoice.status).toBe(InvoiceStatusTypesEnum.SENT);
		expect(webhookEvents.markIgnored).toHaveBeenCalledWith('evt_1');
	});

	it('never records a payment through a connector in test mode, even one that says it was live', async () => {
		const { service, payments, provider } = world();
		provider.isTestMode = true;
		const { headers, rawBody } = notification({ amount: '100' });

		await service.receiveNotification(PROVIDER_ID, headers, rawBody);

		expect(payments).toHaveLength(0);
	});

	it('keeps the signing version a rotation wrote while the settings were being saved', async () => {
		const { service, provider } = world();
		// The rotation landed after the settings request read the registration (version 1)
		provider.configuration = { ...provider.configuration, signingKeyVersion: 2 };

		await service.connect({ checkoutEndpoint: 'https://pay.example.com/v2/checkout' });

		expect(provider.configuration).toMatchObject({
			checkoutEndpoint: 'https://pay.example.com/v2/checkout',
			signingKeyVersion: 2
		});
	});

	it('raises the signing version from the one stored, not from an earlier read', async () => {
		const { service, provider } = world();
		provider.configuration = { ...provider.configuration, signingKeyVersion: 3 };

		const rotated = await service.rotateSecret();

		expect(provider.configuration.signingKeyVersion).toBe(4);
		expect(rotated.signingSecret).toBe(signingSecretOf(PROVIDER_ID, 4, 'k', { ENCRYPTION_KEY: ENV_KEY }));
	});

	/** The connector's reply, played by hand. */
	function connectorReplies(play: (response: EventEmitter & { statusCode: number }) => void) {
		const call = Object.assign(new EventEmitter(), { end: jest.fn(), destroy: jest.fn() });
		(httpsRequest as unknown as jest.Mock).mockImplementation((_url, _options, onResponse) => {
			const response = Object.assign(new EventEmitter(), { statusCode: 200, destroy: jest.fn() });
			setImmediate(() => {
				onResponse(response);
				play(response);
			});
			return call;
		});
		return call;
	}

	it('fails the checkout when the reply breaks off', async () => {
		const { service, token } = world();
		connectorReplies((response) => {
			response.emit('data', Buffer.from('{"url":"https://pay.exa'));
			response.emit('aborted');
			response.emit('error', new Error('socket hang up'));
		});

		await expect(service.startCheckout(INVOICE_ID, token, 'https://app.ever.team/')).rejects.toBeInstanceOf(
			BadGatewayException
		);
	});

	it('fails the checkout when the reply never ends, at the deadline', async () => {
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		const { service, token } = world();
		const call = connectorReplies((response) => response.emit('data', Buffer.from('{"url":')));

		const checkout = service.startCheckout(INVOICE_ID, token, 'https://app.ever.team/');
		const outcome = expect(checkout).rejects.toBeInstanceOf(BadGatewayException);
		await new Promise((resolve) => setImmediate(resolve));
		await jest.advanceTimersByTimeAsync(10_001);

		await outcome;
		expect(call.destroy).toHaveBeenCalled();
	});
});
