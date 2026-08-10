/**
 * Inbound-email capture: storage-key regression tests (`08-permissions-security.md` §5).
 *
 * An attachment file name is the least trusted string this plugin handles. Building the
 * storage key out of it (`documents/inbound/<fileName>`) put every tenant's attachments in
 * ONE flat prefix — two organizations receiving `invoice.pdf` overwrote each other — kept
 * whatever extension the sender chose instead of the sniffed one, and handed a `../`
 * sequence to any storage adapter that does not normalize its keys. The key is now built
 * exactly like the upload endpoint's:
 * `documents/<tenantId>/<organizationId>/<uuid>.<canonicalExtension>`.
 *
 * `@gauzy/core` boots the whole application graph on import, so its `FileStorage` /
 * `TenantSetting` seams are mocked at the module boundary. The sniffer, the key builder and
 * the service under test are real.
 */
const putFile = jest.fn();

jest.mock(
	'@gauzy/core',
	() => ({
		FileStorage: class {
			getProvider() {
				return { name: 'local', putFile };
			}
		},
		TenantSetting: class {},
		RequestContext: { currentUserId: () => undefined }
	}),
	{ virtual: true }
);
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }), { virtual: true });
jest.mock('../docs.config', () => ({
	getDocsConfig: () => ({
		inboundEmailEnabled: true,
		inboundMaxMessageBytes: 26_214_400,
		maxFileSize: 10_485_760
	})
}));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('../services/document-processing.service', () => ({ DocumentProcessingService: class {} }));

import { InboundEmailService } from './inbound-email.service';
import { IInboundEmailAdapter, IInboundWebhookRequest, ParsedInboundEmail } from './inbound-email.types';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';

/** `documents/<tenant>/<org>/<uuid>.<ext>` — the shape the upload endpoint produces. */
const keyShape = (tenantId = TENANT_ID, organizationId = ORGANIZATION_ID) =>
	new RegExp(
		`^documents/${tenantId}/${organizationId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]+$`
	);
const KEY_SHAPE = keyShape();

/** A PDF attachment carrying the given (attacker-supplied) file name. */
const pdfAttachment = (fileName: string) => ({
	fileName,
	contentType: 'application/pdf',
	sizeBytes: 14,
	content: Buffer.from('%PDF-1.7 hello')
});

/**
 * Builds the service over a stub adapter that returns the given attachments, plus an
 * `InboundAddressService` stub that resolves the recipient to a fixed tenant/organization.
 *
 * Resolution moved out of this service into `InboundAddressService`, so what used to be a
 * `tenant_setting` repository stub is now an address-service stub. The seam is narrower on
 * purpose: the delivery path asks two questions ("whose address is this?" and "is this sender
 * allowed?") and nothing about how either is stored.
 */
const buildService = (attachments: any[], scope = { tenantId: TENANT_ID, organizationId: ORGANIZATION_ID }) => {
	const message: ParsedInboundEmail = {
		recipient: 'docs-0123456789abcdef@example.com',
		sender: 'someone@example.com',
		subject: 'Invoice 42',
		messageId: '<abc@mail>',
		receivedAt: new Date(),
		sizeBytes: attachments.reduce((sum, item) => sum + item.sizeBytes, 0),
		spfPass: true,
		dkimPass: true,
		attachments
	} as ParsedInboundEmail;

	const adapter: IInboundEmailAdapter = {
		id: 'test-adapter',
		verifySignature: () => true,
		parse: (_request: IInboundWebhookRequest) => message
	};

	const saved: any[] = [];
	const repository: any = {
		create: (row: any) => row,
		save: async (row: any) => {
			saved.push(row);
			return { ...row, id: `doc-${saved.length}` };
		}
	};
	const processingService: any = { enqueueExtract: jest.fn().mockResolvedValue(true) };
	const inboundAddressService: any = {
		resolveByAddress: async () => ({
			id: 'addr-1',
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			address: 'docs-0123456789abcdef@example.com',
			messageCount: 0
		}),
		isSenderAllowed: () => true,
		verifySecret: () => false,
		recordDelivery: jest.fn().mockResolvedValue(undefined)
	};

	return {
		service: new InboundEmailService(repository, processingService, inboundAddressService, adapter),
		saved
	};
};

describe('InboundEmailService — attachment storage keys', () => {
	beforeEach(() => {
		putFile.mockReset();
		putFile.mockImplementation(async (_content: Buffer, key: string) => ({ key }));
	});

	it('builds a tenant/organization-scoped key with a server-generated uuid and the SNIFFED extension', async () => {
		const { service, saved } = buildService([pdfAttachment('invoice.pdf')]);

		const response = await service.handleWebhook({ headers: {}, body: {} });

		expect(response.accepted).toBe(1);
		expect(putFile).toHaveBeenCalledTimes(1);
		const key = putFile.mock.calls[0][1];
		expect(key).toMatch(KEY_SHAPE);
		expect(key.endsWith('.pdf')).toBe(true);
		// The client name survives as DATA, never as a path segment.
		expect(key).not.toContain('invoice');
		expect(saved[0]).toMatchObject({ name: 'invoice.pdf', originalFilename: 'invoice.pdf', storageKey: key });
	});

	it('cannot be walked out of the prefix by a traversal-shaped file name', async () => {
		const { service } = buildService([pdfAttachment('../../../../etc/passwd.pdf')]);

		await service.handleWebhook({ headers: {}, body: {} });

		const key = putFile.mock.calls[0][1];
		expect(key).toMatch(KEY_SHAPE);
		expect(key).not.toContain('..');
		expect(key).not.toContain('passwd');
		expect(key.startsWith(`documents/${TENANT_ID}/${ORGANIZATION_ID}/`)).toBe(true);
	});

	it('derives the key extension from the sniffed type, not from the sender-chosen name', async () => {
		// PDF bytes under an extension-less name — the key must still say `.pdf`.
		const { service, saved } = buildService([{ ...pdfAttachment('attachment'), contentType: undefined }]);

		await service.handleWebhook({ headers: {}, body: {} });

		expect(putFile.mock.calls[0][1].endsWith('.pdf')).toBe(true);
		expect(saved[0].mimeType).toBe('application/pdf');
		expect(saved[0].originalFilename).toBe('attachment');
	});

	it('separates same-named attachments of different tenants (no cross-tenant overwrite)', async () => {
		const otherTenant = '33333333-3333-4333-8333-333333333333';
		const otherOrganization = '44444444-4444-4444-8444-444444444444';

		const first = buildService([pdfAttachment('invoice.pdf')]);
		await first.service.handleWebhook({ headers: {}, body: {} });
		const second = buildService([pdfAttachment('invoice.pdf')], {
			tenantId: otherTenant,
			organizationId: otherOrganization
		});
		await second.service.handleWebhook({ headers: {}, body: {} });

		expect(putFile.mock.calls[0][1]).toMatch(KEY_SHAPE);
		expect(putFile.mock.calls[1][1]).toMatch(keyShape(otherTenant, otherOrganization));
		expect(putFile.mock.calls[0][1]).not.toBe(putFile.mock.calls[1][1]);
	});
});

/**
 * Gate 2 accepts EITHER the deployment-wide HMAC signature OR a per-address relay secret.
 *
 * The ordering is the security-relevant part: because the address must be resolved before a
 * per-address secret can be checked, resolution necessarily happens on unauthenticated input. The
 * "no valid proof" 403 is therefore raised BEFORE the unknown-address 404 — otherwise a caller
 * holding no secret at all could distinguish a real capture address from a fake one and enumerate
 * every organization's address.
 */
describe('InboundEmailService — gate 2 authentication', () => {
	const buildAuthService = (options: {
		globalSignatureOk: boolean;
		addressExists: boolean;
		perAddressSecretOk: boolean;
	}) => {
		const message: ParsedInboundEmail = {
			recipient: 'docs-0123456789abcdef@example.com',
			sender: 'someone@example.com',
			receivedAt: new Date(),
			sizeBytes: 14,
			spfPass: true,
			dkimPass: true,
			attachments: [pdfAttachment('invoice.pdf')]
		} as ParsedInboundEmail;

		const adapter: IInboundEmailAdapter = {
			id: 'test-adapter',
			verifySignature: () => options.globalSignatureOk,
			parse: (_request: IInboundWebhookRequest) => message
		};
		const repository: any = { create: (row: any) => row, save: async (row: any) => ({ ...row, id: 'doc-1' }) };
		const processingService: any = { enqueueExtract: jest.fn().mockResolvedValue(true) };
		const inboundAddressService: any = {
			resolveByAddress: async () =>
				options.addressExists
					? {
							id: 'addr-1',
							tenantId: TENANT_ID,
							organizationId: ORGANIZATION_ID,
							address: 'docs-0123456789abcdef@example.com',
							messageCount: 0
					  }
					: null,
			isSenderAllowed: () => true,
			verifySecret: () => options.perAddressSecretOk,
			recordDelivery: jest.fn().mockResolvedValue(undefined)
		};
		return new InboundEmailService(repository, processingService, inboundAddressService, adapter);
	};

	beforeEach(() => {
		putFile.mockReset();
		putFile.mockImplementation(async (_content: Buffer, key: string) => ({ key }));
	});

	it('accepts a delivery proved by the deployment-wide signature alone', async () => {
		const service = buildAuthService({ globalSignatureOk: true, addressExists: true, perAddressSecretOk: false });

		const response = await service.handleWebhook({ headers: {}, body: {} });

		expect(response.accepted).toBe(1);
	});

	it('accepts a delivery proved by the per-address secret alone', async () => {
		// The whole point of per-address secrets: a relay can post for ONE organization without
		// holding the deployment-wide secret.
		const service = buildAuthService({ globalSignatureOk: false, addressExists: true, perAddressSecretOk: true });

		const response = await service.handleWebhook({ headers: {}, body: {} });

		expect(response.accepted).toBe(1);
	});

	it('rejects with 403 when neither proof is presented, even though the address is REAL', async () => {
		const service = buildAuthService({ globalSignatureOk: false, addressExists: true, perAddressSecretOk: false });

		await expect(service.handleWebhook({ headers: {}, body: {} })).rejects.toMatchObject({ status: 403 });
	});

	it('rejects an unknown address with the SAME 403 — no enumeration oracle', async () => {
		// Identical status to the real-address case above. If this were a 404, an unauthenticated
		// caller could sweep addresses and learn which ones exist.
		const service = buildAuthService({ globalSignatureOk: false, addressExists: false, perAddressSecretOk: false });

		await expect(service.handleWebhook({ headers: {}, body: {} })).rejects.toMatchObject({ status: 403 });
	});

	it('only reveals "unknown address" (404) to a caller that already proved itself', async () => {
		const service = buildAuthService({ globalSignatureOk: true, addressExists: false, perAddressSecretOk: false });

		await expect(service.handleWebhook({ headers: {}, body: {} })).rejects.toMatchObject({ status: 404 });
	});
});
