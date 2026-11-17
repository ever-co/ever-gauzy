import { decode } from 'jsonwebtoken';
import { IsNull } from 'typeorm';
import { LanguagesEnum } from '@gauzy/contracts';
import { InvoiceService } from './invoice.service';

/**
 * Sending a document by e-mail says what happened, and still never fails its caller.
 *
 * `sendEmail` swallows every failure — the route answers an accepted status whatever the mail transport
 * did, and that is unchanged. It used to answer nothing at all, so a caller that records a document and
 * then sends it (an order's quote) could only report the send as attempted. It now answers whether the
 * message was handed to the transport and, when it was not, which step failed — as a fixed code, never the
 * transport's own text, which can carry the mail server's details.
 *
 * The collaborators are doubled with the calls the method makes: the estimate e-mail record, the
 * organization, the PDF and the mail transport.
 */
function sender(
	overrides: {
		emailInvoice?: jest.Mock;
		createEstimateEmail?: jest.Mock;
		forgetInvoiceDelivery?: jest.Mock;
		confirmDelivery?: jest.Mock;
		findOrganization?: jest.Mock;
		pdf?: Buffer | null;
	} = {}
) {
	const estimateEmailService = {
		createEstimateEmail:
			overrides.createEstimateEmail ?? jest.fn(async () => ({ id: 'estimate-email-1', token: 'estimate-token' })),
		forgetInvoiceDelivery: overrides.forgetInvoiceDelivery ?? jest.fn(async () => undefined),
		confirmDelivery: overrides.confirmDelivery ?? jest.fn(async () => undefined)
	};
	const organizationService = {
		findOneByIdString: overrides.findOrganization ?? jest.fn(async () => ({ id: 'organization-1' }))
	};
	const emailService = { emailInvoice: overrides.emailInvoice ?? jest.fn(async () => true) };
	const service = new InvoiceService(
		{} as never,
		{} as never,
		emailService as never,
		estimateEmailService as never,
		{} as never,
		{} as never,
		organizationService as never
	);

	jest.spyOn(service, 'generateInvoicePdf').mockResolvedValue(
		(overrides.pdf === undefined ? Buffer.from('%PDF') : overrides.pdf) as never
	);

	return { service, emailService, estimateEmailService };
}

/** One send, as the order's quote asks for it. */
const send = (service: InvoiceService) =>
	service.sendEmail(
		LanguagesEnum.ENGLISH,
		'buyer@client.test',
		42,
		'invoice-42',
		true,
		'https://app.example.com',
		'organization-1'
	);

/** One invoice (not an estimate) emailed in French. */
const sendInvoice = (service: InvoiceService) =>
	service.sendEmail(
		LanguagesEnum.FRENCH,
		'billing@client.test',
		43,
		'invoice-43',
		false,
		'https://app.example.com',
		'organization-1'
	);

describe('InvoiceService.sendEmail — the outcome of a send', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('answers sent once the transport accepted the message', async () => {
		const { service, emailService } = sender();

		await expect(send(service)).resolves.toEqual({ sent: true });
		expect(emailService.emailInvoice).toHaveBeenCalledWith(
			LanguagesEnum.ENGLISH,
			'buyer@client.test',
			Buffer.from('%PDF').toString('base64'),
			42,
			'invoice-42',
			true,
			'estimate-token',
			'https://app.example.com',
			{ id: 'organization-1' }
		);
	});

	it('answers EMAIL_NOT_SENT when the transport refused it — with a code, not the server’s message', async () => {
		const { service } = sender({
			emailInvoice: jest.fn(async () => {
				throw new Error('connect ECONNREFUSED smtp.internal.example:587');
			})
		});

		const outcome = await send(service);

		expect(outcome).toEqual({ sent: false, reason: 'EMAIL_NOT_SENT' });
		expect(JSON.stringify(outcome)).not.toContain('smtp.internal');
	});

	it('answers EMAIL_NOT_SENT when the address is of a domain the platform never emails', async () => {
		const { service } = sender({ emailInvoice: jest.fn(async () => false) });

		await expect(send(service)).resolves.toEqual({ sent: false, reason: 'EMAIL_NOT_SENT' });
	});

	it('answers DOCUMENT_NOT_GENERATED when no PDF could be attached, and sends nothing', async () => {
		const { service, emailService } = sender({ pdf: null });

		await expect(send(service)).resolves.toEqual({ sent: false, reason: 'DOCUMENT_NOT_GENERATED' });
		expect(emailService.emailInvoice).not.toHaveBeenCalled();
	});

	it('answers EMAIL_NOT_PREPARED when the estimate e-mail record could not be written', async () => {
		const { service, emailService } = sender({
			createEstimateEmail: jest.fn(async () => {
				throw new Error('insert failed');
			})
		});

		await expect(send(service)).resolves.toEqual({ sent: false, reason: 'EMAIL_NOT_PREPARED' });
		expect(emailService.emailInvoice).not.toHaveBeenCalled();
	});
});

/**
 * An invoice's email row names the invoice it delivers and its language from its creation, so no write after the send
 * can fail to, and the invoice's payment reminders go to that address, in that language. When the email does not go,
 * the row forgets both, so the reminders keep going where the invoice last went. An estimate's email names nothing.
 */
describe('InvoiceService.sendEmail — where an invoice went', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('names the invoice and its language on the email row it creates, and keeps them once the email went', async () => {
		const { service, estimateEmailService } = sender();

		await expect(sendInvoice(service)).resolves.toEqual({ sent: true });

		expect(estimateEmailService.createEstimateEmail).toHaveBeenCalledWith('invoice-43', 'billing@client.test', {
			languageCode: LanguagesEnum.FRENCH
		});
		expect(estimateEmailService.forgetInvoiceDelivery).not.toHaveBeenCalled();
	});

	it("names nothing on an estimate's email, and forgets nothing when it does not go", async () => {
		const { service, estimateEmailService } = sender({
			emailInvoice: jest.fn(async () => {
				throw new Error('connect ECONNREFUSED smtp.internal.example:587');
			})
		});

		await expect(send(service)).resolves.toEqual({ sent: false, reason: 'EMAIL_NOT_SENT' });

		expect(estimateEmailService.createEstimateEmail).toHaveBeenCalledWith(
			'invoice-42',
			'buyer@client.test',
			undefined
		);
		expect(estimateEmailService.forgetInvoiceDelivery).not.toHaveBeenCalled();
	});

	it('forgets them when the transport refused the email', async () => {
		const { service, estimateEmailService } = sender({
			emailInvoice: jest.fn(async () => {
				throw new Error('connect ECONNREFUSED smtp.internal.example:587');
			})
		});

		await expect(sendInvoice(service)).resolves.toEqual({ sent: false, reason: 'EMAIL_NOT_SENT' });

		expect(estimateEmailService.forgetInvoiceDelivery).toHaveBeenCalledWith('estimate-email-1');
	});

	it('forgets them when the address is of a domain the platform never emails', async () => {
		const { service, estimateEmailService } = sender({ emailInvoice: jest.fn(async () => false) });

		await expect(sendInvoice(service)).resolves.toEqual({ sent: false, reason: 'EMAIL_NOT_SENT' });

		expect(estimateEmailService.forgetInvoiceDelivery).toHaveBeenCalledWith('estimate-email-1');
	});

	it('forgets them when the organization could not be read', async () => {
		const { service, emailService, estimateEmailService } = sender({
			findOrganization: jest.fn(async () => {
				throw new Error('organization not found');
			})
		});

		await expect(sendInvoice(service)).resolves.toEqual({ sent: false, reason: 'EMAIL_NOT_PREPARED' });

		expect(emailService.emailInvoice).not.toHaveBeenCalled();
		expect(estimateEmailService.forgetInvoiceDelivery).toHaveBeenCalledWith('estimate-email-1');
	});

	it('forgets them when no PDF could be attached', async () => {
		const { service, estimateEmailService } = sender({ pdf: null });

		await expect(sendInvoice(service)).resolves.toEqual({ sent: false, reason: 'DOCUMENT_NOT_GENERATED' });

		expect(estimateEmailService.forgetInvoiceDelivery).toHaveBeenCalledWith('estimate-email-1');
	});

	it('still answers the failed send when forgetting fails, and says where the reminders may go', async () => {
		const { service } = sender({
			emailInvoice: jest.fn(async () => {
				throw new Error('connect ECONNREFUSED smtp.internal.example:587');
			}),
			forgetInvoiceDelivery: jest.fn(async () => {
				throw new Error('update failed');
			})
		});

		await expect(sendInvoice(service)).resolves.toEqual({ sent: false, reason: 'EMAIL_NOT_SENT' });
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('may go to that address'), 'update failed');
	});
});

/**
 * The email's row is written before the PDF is rendered and the email handed over, so on its own it records an attempt:
 * a process stopped in between leaves it behind with nothing sent. The row says the email went (`sentAt`) only once the
 * transport took it, and whoever asks whether an invoice was emailed reads that (Greptile on ever-co/ever-gauzy#12039).
 */
describe('InvoiceService.sendEmail — whether the email went', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it("confirms the email's row once the transport took the email, and not before", async () => {
		let accept: (handed: boolean) => void = () => undefined;
		const { service, emailService, estimateEmailService } = sender({
			emailInvoice: jest.fn(() => new Promise<boolean>((resolve) => (accept = resolve)))
		});

		const sending = sendInvoice(service);
		// The transport has the email and has not taken it yet: the row is still an attempt
		for (let turn = 0; turn < 20 && emailService.emailInvoice.mock.calls.length === 0; turn++) {
			await new Promise((resolve) => setImmediate(resolve));
		}
		expect(emailService.emailInvoice).toHaveBeenCalledTimes(1);
		expect(estimateEmailService.confirmDelivery).not.toHaveBeenCalled();

		accept(true);

		await expect(sending).resolves.toEqual({ sent: true });
		expect(estimateEmailService.confirmDelivery).toHaveBeenCalledWith('estimate-email-1');
	});

	it('leaves the row an attempt when the process stops between writing it and the mail call', async () => {
		const { service, emailService, estimateEmailService } = sender();
		// The process stops while the PDF renders: nothing after it runs
		jest.spyOn(service, 'generateInvoicePdf').mockReturnValue(new Promise(() => undefined) as never);

		void sendInvoice(service);
		await new Promise((resolve) => setImmediate(resolve));

		expect(estimateEmailService.createEstimateEmail).toHaveBeenCalledWith('invoice-43', 'billing@client.test', {
			languageCode: LanguagesEnum.FRENCH
		});
		expect(emailService.emailInvoice).not.toHaveBeenCalled();
		expect(estimateEmailService.confirmDelivery).not.toHaveBeenCalled();
	});

	it.each([
		[
			'the transport refused it',
			() => ({
				emailInvoice: jest.fn(async () => {
					throw new Error('connect ECONNREFUSED smtp.internal.example:587');
				})
			})
		],
		['the address is of a domain the platform never emails', () => ({ emailInvoice: jest.fn(async () => false) })],
		['no PDF could be attached', () => ({ pdf: null })]
	])('confirms nothing when %s', async (_case, overrides) => {
		const { service, estimateEmailService } = sender(overrides());

		await expect(sendInvoice(service)).resolves.toMatchObject({ sent: false });

		expect(estimateEmailService.confirmDelivery).not.toHaveBeenCalled();
	});

	it("confirms an estimate's email as well", async () => {
		const { service, estimateEmailService } = sender();

		await expect(send(service)).resolves.toEqual({ sent: true });

		expect(estimateEmailService.confirmDelivery).toHaveBeenCalledWith('estimate-email-1');
	});

	it('still answers sent when the confirmation could not be written, and says a recovery may send it again', async () => {
		const { service, estimateEmailService } = sender({
			confirmDelivery: jest.fn(async () => {
				throw new Error('update failed');
			})
		});

		await expect(sendInvoice(service)).resolves.toEqual({ sent: true });

		expect(estimateEmailService.forgetInvoiceDelivery).not.toHaveBeenCalled();
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('a recovery may email it again'), 'update failed');
	});
});

/**
 * An invoice's email links to its public page (ever-co/ever-gauzy#11856): the client opens the invoice there without an
 * account. The link is the invoice's own share token, kept as it is, so a link the client already holds still works.
 */
describe('InvoiceService.sendEmail — the link to the public page', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it("passes the invoice's share token to the email", async () => {
		const { service, emailService } = sender();
		jest.spyOn(service, 'publicLinkTokenOf').mockResolvedValue('share-token');

		await expect(sendInvoice(service)).resolves.toEqual({ sent: true });

		expect(service.publicLinkTokenOf).toHaveBeenCalledWith('invoice-43');
		expect(emailService.emailInvoice).toHaveBeenCalledWith(
			LanguagesEnum.FRENCH,
			'billing@client.test',
			Buffer.from('%PDF').toString('base64'),
			43,
			'invoice-43',
			false,
			'estimate-token',
			'https://app.example.com',
			{ id: 'organization-1' },
			'share-token'
		);
	});

	it("never reads a share token for an estimate's email", async () => {
		const { service } = sender();
		jest.spyOn(service, 'publicLinkTokenOf').mockResolvedValue('share-token');

		await expect(send(service)).resolves.toEqual({ sent: true });

		expect(service.publicLinkTokenOf).not.toHaveBeenCalled();
	});

	it('still sends the invoice when it has no link to give', async () => {
		const { service, emailService } = sender();
		jest.spyOn(service, 'publicLinkTokenOf').mockResolvedValue(null);

		await expect(sendInvoice(service)).resolves.toEqual({ sent: true });

		expect(emailService.emailInvoice.mock.calls[0]).toHaveLength(9);
	});
});

/** The share token an invoice's email carries, and the revocation of a link. */
describe('InvoiceService — the public link of an invoice', () => {
	const INVOICE = { id: 'invoice-7', tenantId: 'tenant-1', organizationId: 'organization-1' };

	/**
	 * `read`: the token the invoice has when it is read through the service (possibly a cached entity).
	 * `inDatabase`: the token the database holds after the write, read back through the repository that wrote it.
	 */
	function linker(read: string | null, inDatabase: string | null = null) {
		const update = jest.fn(async (_where: unknown, _values: unknown) => ({ affected: 1 }));
		const findOne = jest.fn(async () => ({ id: INVOICE.id, token: inDatabase }));
		// The transaction the token is written in (ever-co/ever-gauzy#12039): it locks the invoice, writes the token
		// (recorded by `update`, as the repository's own write was), and moves the invoice's `updatedAt` past HELD_AT
		const touches: Array<{ updatedAt: Date }> = [];
		const query: Record<string, unknown> = {};
		Object.assign(query, {
			update: () => query,
			set: (values: { updatedAt: Date }) => {
				touches.push(values);
				return query;
			},
			where: () => query,
			andWhere: () => query,
			callListeners: () => query,
			execute: async () => ({ affected: 1 })
		});
		const manager = {
			findOne: jest.fn(async () => ({ id: INVOICE.id, updatedAt: HELD_AT })),
			update: jest.fn(async (_entity: unknown, where: unknown, values: unknown) => update(where, values)),
			createQueryBuilder: () => query
		};
		const transaction = jest.fn(async (work: (inTransaction: typeof manager) => Promise<unknown>) => work(manager));
		const service = new InvoiceService(
			{ update, findOne, manager: { transaction } } as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		);
		const reads = jest
			.spyOn(service, 'findOneByIdString')
			.mockImplementation(async () => ({ ...INVOICE, token: read }) as never);
		return { service, update, findOne, reads, touches, transaction };
	}

	/** The `updatedAt` the invoice holds when the token is written. */
	const HELD_AT = new Date('2026-11-16T10:20:30.456Z');

	/** The claims of the token a write stored. */
	const claimsOfWrite = (update: jest.Mock, call: number) =>
		decode((update.mock.calls[call] as unknown as [unknown, { token: string }])[1].token) as Record<
			string,
			unknown
		>;

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('keeps the token the invoice already has, so a link the client holds still opens it', async () => {
		const { service, update } = linker('created-token');

		await expect(service.publicLinkTokenOf(INVOICE.id)).resolves.toBe('created-token');
		expect(update).not.toHaveBeenCalled();
	});

	it('gives an invoice whose link was revoked a new token, written only where it still has none', async () => {
		const { service, update } = linker(null, 'written-token');

		await expect(service.publicLinkTokenOf(INVOICE.id)).resolves.toBe('written-token');

		expect(update).toHaveBeenCalledTimes(1);
		const [where, values] = update.mock.calls[0] as unknown as [Record<string, unknown>, { token: string }];
		expect(where).toMatchObject({ id: INVOICE.id, tenantId: INVOICE.tenantId });
		// Conditional on the token still being null: a send at the same moment that wrote first keeps its link
		expect(where.token).toEqual(IsNull());
		expect(typeof values.token).toBe('string');
	});

	it('never signs the revoked token again, even within the same second (CodeRabbit on #11993)', async () => {
		const { service, update } = linker(null, 'written-token');

		await service.publicLinkTokenOf(INVOICE.id);
		await service.publicLinkTokenOf(INVOICE.id);

		const first = claimsOfWrite(update, 0);
		const second = claimsOfWrite(update, 1);
		expect(first.jti).toEqual(expect.any(String));
		expect(second.jti).not.toBe(first.jti);
	});

	it('answers the token another send wrote first', async () => {
		const { service, update } = linker(null, 'token-of-the-other-send');
		update.mockResolvedValue({ affected: 0 });

		await expect(service.publicLinkTokenOf(INVOICE.id)).resolves.toBe('token-of-the-other-send');
	});

	it('reads the token back from the database, not from the entity read before the write (CodeRabbit on #11993)', async () => {
		// Under MikroORM a second read through the service can answer the cached entity, still without a token
		const { service, findOne, reads } = linker(null, 'written-token');

		await expect(service.publicLinkTokenOf(INVOICE.id)).resolves.toBe('written-token');

		expect(reads).toHaveBeenCalledTimes(1);
		expect(findOne).toHaveBeenCalledWith({
			where: { id: INVOICE.id, tenantId: INVOICE.tenantId },
			select: { id: true, token: true }
		});
	});

	it('answers null when the invoice cannot be read, so the email goes without a link', async () => {
		const { service, reads } = linker(null);
		reads.mockRejectedValue(new Error('not found'));

		await expect(service.publicLinkTokenOf(INVOICE.id)).resolves.toBeNull();
	});

	it("revokes a link by clearing the token of the caller's invoice", async () => {
		const { service, update, reads } = linker('created-token');

		await service.revokeLink(INVOICE.id);

		expect(reads).toHaveBeenCalledWith(INVOICE.id);
		expect(update).toHaveBeenCalledWith({ id: INVOICE.id, tenantId: INVOICE.tenantId }, { token: null });
	});

	it("moves the invoice's updatedAt past the value it held, in the transaction that writes the token (#12039)", async () => {
		const revoking = linker('created-token');
		await revoking.service.revokeLink(INVOICE.id);

		const sending = linker(null, 'written-token');
		await sending.service.publicLinkTokenOf(INVOICE.id);

		for (const { touches, transaction } of [revoking, sending]) {
			expect(transaction).toHaveBeenCalledTimes(1);
			expect(touches).toHaveLength(1);
			expect(touches[0].updatedAt.getTime()).toBeGreaterThan(HELD_AT.getTime());
		}
	});

	it('moves nothing when the token was not written: another send wrote its own first', async () => {
		const { service, update, touches } = linker(null, 'token-of-the-other-send');
		update.mockResolvedValue({ affected: 0 });

		await service.publicLinkTokenOf(INVOICE.id);

		expect(touches).toHaveLength(0);
	});

	it("revokes nothing for an invoice outside the caller's tenant", async () => {
		const { service, update, reads } = linker(null);
		reads.mockRejectedValue(new Error('Record not found'));

		await expect(service.revokeLink(INVOICE.id)).rejects.toThrow('Record not found');
		expect(update).not.toHaveBeenCalled();
	});
});
