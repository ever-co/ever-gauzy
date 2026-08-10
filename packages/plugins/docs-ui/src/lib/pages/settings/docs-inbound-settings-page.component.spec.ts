/**
 * `@gauzy/ui-core/i18n` and `@gauzy/ui-core/core` are barrels over the whole app: importing
 * them pulls Akita's untranspiled ESM (and every shared component) into the CommonJS test
 * runtime. The page is constructed directly with doubles — no `TestBed`
 * (see `docs-settings-page.component.spec.ts`).
 */
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));

import { of, throwError } from 'rxjs';
import {
	DocumentInboundAddressKindEnum,
	DocumentInboundDomainStatusEnum,
	ID,
	IDocumentInboundDomainVerification
} from '@gauzy/contracts';
import { IDocumentInboundAddressView } from '../../models/docs-inbound.model';
import { DocsInboundSettingsPageComponent } from './docs-inbound-settings-page.component';

const PLATFORM_ID = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const CUSTOM_ID = 'aaaaaaaa-2222-4222-8222-222222222222' as ID;

function platformRow(overrides: Partial<IDocumentInboundAddressView> = {}): IDocumentInboundAddressView {
	return {
		id: PLATFORM_ID,
		kind: DocumentInboundAddressKindEnum.PLATFORM,
		address: 'docs-abc123@inbound.gauzy.co',
		domainStatus: DocumentInboundDomainStatusEnum.VERIFIED,
		senderAllowlist: [],
		importBodyAsNote: false,
		isActive: true,
		...overrides
	} as IDocumentInboundAddressView;
}

function customRow(overrides: Partial<IDocumentInboundAddressView> = {}): IDocumentInboundAddressView {
	return {
		id: CUSTOM_ID,
		kind: DocumentInboundAddressKindEnum.CUSTOM_DOMAIN,
		domain: 'example.com',
		localPart: 'docs',
		address: 'docs@example.com',
		domainStatus: DocumentInboundDomainStatusEnum.PENDING,
		senderAllowlist: ['ceo@example.com'],
		importBodyAsNote: false,
		isActive: true,
		...overrides
	} as IDocumentInboundAddressView;
}

function verification(
	status = DocumentInboundDomainStatusEnum.PENDING,
	message?: string
): IDocumentInboundDomainVerification {
	return {
		recordType: 'TXT',
		recordName: '_gauzy-docs.example.com',
		recordValue: 'gauzy-docs-verify=deadbeef',
		status,
		verifiedAt: null,
		lastCheckedAt: null,
		message
	};
}

/**
 * `JSON.stringify` with repeated references dropped.
 *
 * A row holds its own `ngTemplateOutlet` context (`{ $implicit: row }`), so it is deliberately
 * circular — a plain stringify throws. The `seen` set visits each object once, which is exactly
 * what a "does this string appear ANYWHERE in the view state" assertion needs.
 */
function deepSerialize(value: unknown): string {
	const seen = new WeakSet<object>();
	return JSON.stringify(value, (_key, entry: unknown) => {
		if (entry && typeof entry === 'object') {
			if (seen.has(entry as object)) return undefined;
			seen.add(entry as object);
		}
		return entry;
	});
}

function createPage(addresses: IDocumentInboundAddressView[] = [platformRow(), customRow()]) {
	const inboundService = {
		getAll: jest.fn(() => of(addresses)),
		create: jest.fn(),
		getVerification: jest.fn(() => of(verification())),
		verify: jest.fn(),
		rotateSecret: jest.fn(),
		rotateAddress: jest.fn(),
		update: jest.fn()
	};
	const documentsService = { getSettings: jest.fn(() => of(null)) };
	const toastrService = { success: jest.fn(), warning: jest.fn(), danger: jest.fn() };
	const dialogService = { open: jest.fn(() => ({ onClose: of(null) })) };
	const store = { selectedOrganization: { id: 'org', tenantId: 'tenant' }, selectedOrganization$: of(null) };

	const page = new DocsInboundSettingsPageComponent(
		{ instant: (key: string) => key } as never,
		inboundService as never,
		documentsService as never,
		toastrService as never,
		dialogService as never,
		store as never
	);
	return { page, inboundService, documentsService, toastrService, dialogService };
}

describe('DocsInboundSettingsPageComponent — inbound capture (spec 07 §17.2)', () => {
	describe('loading', () => {
		it('splits the two kinds of address into their own cards', async () => {
			const { page } = createPage();

			await page.load();

			expect(page.platform?.address.address).toBe('docs-abc123@inbound.gauzy.co');
			expect(page.customDomains).toHaveLength(1);
			expect(page.customDomains[0].address.address).toBe('docs@example.com');
		});

		it('fetches the DNS record for a custom domain only', async () => {
			const { page, inboundService } = createPage();

			await page.load();

			expect(inboundService.getVerification).toHaveBeenCalledTimes(1);
			expect(inboundService.getVerification).toHaveBeenCalledWith(CUSTOM_ID);
			expect(page.customDomains[0].verification?.recordName).toBe('_gauzy-docs.example.com');
			// A PLATFORM address has nothing to prove — the platform owns the domain.
			expect(page.platform?.verification).toBeNull();
		});

		it('degrades one failed record probe instead of failing the page', async () => {
			const { page, inboundService } = createPage();
			inboundService.getVerification.mockReturnValue(throwError(() => new Error('boom')));

			await page.load();

			expect(page.loadError).toBe(false);
			expect(page.customDomains).toHaveLength(1);
			expect(page.customDomains[0].verification).toBeNull();
		});

		it('reports a 404 as "not deployed", not as an error the user can act on', async () => {
			const { page, inboundService, toastrService } = createPage();
			inboundService.getAll.mockReturnValue(throwError(() => ({ status: 404 })));

			await page.load();

			expect(page.unsupported).toBe(true);
			expect(page.loadError).toBe(false);
			expect(toastrService.danger).not.toHaveBeenCalled();
		});

		it('says so plainly when the deployment mints no shared address', async () => {
			const { page } = createPage([]);

			await page.load();

			// An empty list means `GAUZY_DOCS_INBOUND_DOMAIN` is unset — there was nothing to mint.
			expect(page.platform).toBeNull();
			expect(page.customDomains).toEqual([]);
			expect(page.loadError).toBe(false);
		});
	});

	describe('reference stability', () => {
		it('keeps ONE array identity for the rows `*ngFor` iterates', async () => {
			const { page } = createPage();

			await page.load();
			const rows = page.customDomains;
			const row = page.customDomains[0];
			const allowlist = row.allowlist;

			// Re-reading is what change detection does, dozens of times per interaction. A getter
			// that rebuilt either array here re-rendered `*ngFor` on every pass — the exact
			// pattern that pegged the main thread in the filter bar.
			expect(page.customDomains).toBe(rows);
			expect(page.customDomains[0]).toBe(row);
			expect(page.customDomains[0].allowlist).toBe(allowlist);
		});

		it('gives every row a pre-built, self-referential outlet context', async () => {
			const { page } = createPage();

			await page.load();
			const row = page.customDomains[0];

			// The template passes `context: row.context`; an inline `{ $implicit: row }` would
			// allocate a fresh context object on every change-detection pass.
			expect(row.context.$implicit).toBe(row);
			expect(page.customDomains[0].context).toBe(row.context);
		});

		it('allocates a new allowlist array ONLY when the contents actually change', async () => {
			const { page } = createPage();

			await page.load();
			const row = page.customDomains[0];
			const before = row.allowlist;

			row.allowlistEntry = 'not a valid entry';
			page.addAllowlistEntry(row);
			expect(row.allowlist).toBe(before); // rejected — no reallocation

			row.allowlistEntry = 'cfo@example.com';
			page.addAllowlistEntry(row);
			expect(row.allowlist).not.toBe(before);
			expect(row.allowlist).toEqual(['ceo@example.com', 'cfo@example.com']);
		});
	});

	describe('sender allowlist', () => {
		it('accepts an address, a bare domain and an @domain, and refuses anything else', async () => {
			const { page } = createPage();
			await page.load();
			const row = page.customDomains[0];

			for (const entry of ['cfo@example.com', 'partner.co.uk', '@vendor.io']) {
				row.allowlistEntry = entry;
				expect(page.canAddAllowlistEntry(row)).toBe(true);
			}
			for (const entry of ['', 'not-a-domain', 'two words@example.com', '@', 'ceo@example.com']) {
				row.allowlistEntry = entry;
				// The last one is already on the list — a duplicate is refused, not silently merged.
				expect(page.canAddAllowlistEntry(row)).toBe(false);
			}
		});

		it('sends the whole list on save and adopts the server echo', async () => {
			const { page, inboundService } = createPage();
			inboundService.update.mockReturnValue(
				of(customRow({ senderAllowlist: ['ceo@example.com', 'cfo@example.com'] }))
			);
			await page.load();
			const row = page.customDomains[0];

			row.allowlistEntry = 'cfo@example.com';
			page.addAllowlistEntry(row);
			expect(row.allowlistDirty).toBe(true);

			await page.saveAllowlist(row);

			expect(inboundService.update).toHaveBeenCalledWith(CUSTOM_ID, {
				senderAllowlist: ['ceo@example.com', 'cfo@example.com']
			});
			expect(row.allowlistDirty).toBe(false);
		});

		it('clears the list with an EMPTY ARRAY, not by omitting the field', async () => {
			const { page, inboundService } = createPage();
			inboundService.update.mockReturnValue(of(customRow({ senderAllowlist: [] })));
			await page.load();
			const row = page.customDomains[0];

			page.removeAllowlistEntry(row, 'ceo@example.com');
			await page.saveAllowlist(row);

			// Omitting it leaves the old list in place; `[]` is what the server reads as
			// "accept any sender that passes SPF/DKIM".
			expect(inboundService.update).toHaveBeenCalledWith(CUSTOM_ID, { senderAllowlist: [] });
		});

		it('reads as clean again when an addition is undone', async () => {
			const { page } = createPage();
			await page.load();
			const row = page.customDomains[0];

			row.allowlistEntry = 'cfo@example.com';
			page.addAllowlistEntry(row);
			expect(row.allowlistDirty).toBe(true);

			page.removeAllowlistEntry(row, 'cfo@example.com');
			expect(row.allowlistDirty).toBe(false);
		});

		it('does not discard an unsaved draft when an unrelated toggle is saved', async () => {
			const { page, inboundService } = createPage();
			inboundService.update.mockReturnValue(of(customRow({ importBodyAsNote: true })));
			await page.load();
			const row = page.customDomains[0];

			row.allowlistEntry = 'cfo@example.com';
			page.addAllowlistEntry(row);
			page.onImportBodyToggle(row, true);
			await Promise.resolve();
			await Promise.resolve();

			expect(row.allowlist).toEqual(['ceo@example.com', 'cfo@example.com']);
			expect(row.allowlistDirty).toBe(true);
		});
	});

	describe('toggles', () => {
		it('reverts the row when the save fails, so the toggle cannot lie', async () => {
			const { page, inboundService, toastrService } = createPage();
			inboundService.update.mockReturnValue(throwError(() => new Error('nope')));
			await page.load();
			const row = page.customDomains[0];

			page.onActiveToggle(row, false);
			await Promise.resolve();
			await Promise.resolve();

			// `nb-toggle` binds through `[checked]`: without restoring the snapshot the binding
			// value never changes back and the switch stays visually flipped.
			expect(row.address.isActive).toBe(true);
			expect(toastrService.danger).toHaveBeenCalled();
			expect(row.busy).toBe(false);
		});
	});

	describe('domain verification', () => {
		it('warns rather than celebrating when the record is still missing', async () => {
			const { page, inboundService, toastrService } = createPage();
			inboundService.verify.mockReturnValue(
				of(verification(DocumentInboundDomainStatusEnum.PENDING, 'The expected TXT record was not found.'))
			);
			await page.load();
			const row = page.customDomains[0];

			await page.verify(row);

			// 🛑 A missing record is a 200 with a message, not a thrown error — a catch-only
			// implementation would report success for every failure.
			expect(toastrService.warning).toHaveBeenCalledWith('The expected TXT record was not found.');
			expect(toastrService.success).not.toHaveBeenCalled();
			expect(row.address.domainStatus).toBe(DocumentInboundDomainStatusEnum.PENDING);
		});

		it('moves the row to VERIFIED so the badge and the "mail is rejected" copy agree', async () => {
			const { page, inboundService, toastrService } = createPage();
			inboundService.verify.mockReturnValue(of(verification(DocumentInboundDomainStatusEnum.VERIFIED)));
			await page.load();
			const row = page.customDomains[0];

			await page.verify(row);

			expect(row.address.domainStatus).toBe(DocumentInboundDomainStatusEnum.VERIFIED);
			expect(row.verification?.status).toBe(DocumentInboundDomainStatusEnum.VERIFIED);
			expect(toastrService.success).toHaveBeenCalledWith('DOCS.INBOUND.TOAST_VERIFIED');
		});

		it('labels FAILED as danger — mail that used to work now bounces', () => {
			const { page } = createPage();

			expect(page.statusBadge(DocumentInboundDomainStatusEnum.FAILED)).toBe('danger');
			expect(page.statusBadge(DocumentInboundDomainStatusEnum.PENDING)).toBe('warning');
			expect(page.statusBadge(DocumentInboundDomainStatusEnum.VERIFIED)).toBe('success');
			expect(page.statusHintKey(DocumentInboundDomainStatusEnum.FAILED)).toBe(
				'DOCS.INBOUND.STATUS_FAILED_HINT'
			);
		});
	});

	describe('the one-time relay secret', () => {
		it('reveals the create secret BEFORE the reload that would destroy it', async () => {
			const { page, inboundService, dialogService } = createPage();
			const created = {
				address: customRow(),
				secret: { address: 'docs@example.com', webhookSecret: 'plaintext-secret' },
				verification: verification()
			};
			inboundService.create.mockReturnValue(of(created));
			dialogService.open
				.mockReturnValueOnce({ onClose: of({ domain: 'example.com', localPart: 'docs', importBodyAsNote: false }) })
				.mockReturnValue({ onClose: of(true) });

			await page.addDomain();

			const revealCall = dialogService.open.mock.calls[1];
			expect(revealCall[1].context.secret).toBe(created.secret);
			// The plaintext exists nowhere else: a stray Esc or backdrop click must not be able to
			// throw away a value that can never be asked for again.
			expect(revealCall[1].closeOnEsc).toBe(false);
			expect(revealCall[1].closeOnBackdropClick).toBe(false);
		});

		it('reveals a rotated secret the same way', async () => {
			const { page, inboundService, dialogService } = createPage();
			const secret = { address: 'docs@example.com', webhookSecret: 'rotated-secret' };
			inboundService.rotateSecret.mockReturnValue(of(secret));
			dialogService.open.mockReturnValue({ onClose: of(true) });
			await page.load();
			const row = page.customDomains[0];

			await page.rotateSecret(row);

			expect(dialogService.open.mock.calls[0][1].context.secret).toBe(secret);
			expect(row.confirm).toBeNull();
		});

		it('never keeps the plaintext secret on the component or on a row', async () => {
			const { page, inboundService, dialogService } = createPage();
			inboundService.rotateSecret.mockReturnValue(
				of({ address: 'docs@example.com', webhookSecret: 'must-not-persist' })
			);
			dialogService.open.mockReturnValue({ onClose: of(true) });
			await page.load();

			await page.rotateSecret(page.customDomains[0]);

			// The server keeps only a SHA-256; anything we cached would be the single most
			// valuable string on the page and would outlive the dialog that justified it.
			expect(deepSerialize({ platform: page.platform, customDomains: page.customDomains })).not.toContain(
				'must-not-persist'
			);
		});

	});

	describe('rotation is a two-step action', () => {
		it('arms and disarms the inline confirmation', async () => {
			const { page } = createPage();
			await page.load();
			const row = page.platform as NonNullable<typeof page.platform>;

			expect(row.confirm).toBeNull();
			page.askConfirm(row, 'address');
			expect(row.confirm).toBe('address');
			page.cancelConfirm(row);
			expect(row.confirm).toBeNull();
		});

		it('refuses to arm while the row is already busy', async () => {
			const { page } = createPage();
			await page.load();
			const row = page.platform as NonNullable<typeof page.platform>;
			row.busy = true;

			page.askConfirm(row, 'address');

			expect(row.confirm).toBeNull();
		});

		it('replaces the platform address from the rotate response', async () => {
			const { page, inboundService, toastrService } = createPage();
			inboundService.rotateAddress.mockReturnValue(of(platformRow({ address: 'docs-newtoken@inbound.gauzy.co' })));
			await page.load();
			const row = page.platform as NonNullable<typeof page.platform>;

			page.askConfirm(row, 'address');
			await page.rotateAddress(row);

			expect(row.address.address).toBe('docs-newtoken@inbound.gauzy.co');
			expect(row.confirm).toBeNull();
			expect(toastrService.success).toHaveBeenCalledWith('DOCS.INBOUND.TOAST_ADDRESS_ROTATED');
		});
	});

	describe('clipboard', () => {
		it('swallows a denied clipboard permission instead of shouting about it', async () => {
			const { page, toastrService } = createPage();
			Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.reject(new Error('denied'))) } });

			await page.copy('docs@example.com', 'DOCS.INBOUND.TOAST_ADDRESS_COPIED');

			// The value is selectable on screen either way — there is nothing to roll back and
			// nothing the user can do about it.
			expect(toastrService.danger).not.toHaveBeenCalled();
			expect(toastrService.success).not.toHaveBeenCalled();
		});

		it('confirms a successful copy', async () => {
			const { page, toastrService } = createPage();
			const writeText = jest.fn(() => Promise.resolve());
			Object.assign(navigator, { clipboard: { writeText } });

			await page.copy('docs@example.com', 'DOCS.INBOUND.TOAST_ADDRESS_COPIED');

			expect(writeText).toHaveBeenCalledWith('docs@example.com');
			expect(toastrService.success).toHaveBeenCalledWith('DOCS.INBOUND.TOAST_ADDRESS_COPIED');
		});
	});
});
