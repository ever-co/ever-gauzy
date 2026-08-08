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
 * Builds the service over a stub adapter that returns the given attachments, plus a
 * repository stub that resolves the capture token to a fixed tenant/organization.
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
		},
		manager: {
			find: async () => [
				{
					name: `docs.${scope.organizationId}.inboundToken`,
					value: '0123456789abcdef',
					tenantId: scope.tenantId
				}
			]
		}
	};
	const processingService: any = { enqueueExtract: jest.fn().mockResolvedValue(true) };

	return { service: new InboundEmailService(repository, processingService, adapter), saved };
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
