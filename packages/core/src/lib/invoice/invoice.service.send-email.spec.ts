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
function sender(overrides: { emailInvoice?: jest.Mock; createEstimateEmail?: jest.Mock; pdf?: Buffer | null } = {}) {
	const estimateEmailService = {
		createEstimateEmail: overrides.createEstimateEmail ?? jest.fn(async () => ({ token: 'estimate-token' }))
	};
	const organizationService = { findOneByIdString: jest.fn(async () => ({ id: 'organization-1' })) };
	const emailService = { emailInvoice: overrides.emailInvoice ?? jest.fn(async () => undefined) };
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
		'buyer@example.com',
		42,
		'invoice-42',
		true,
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
			'buyer@example.com',
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
