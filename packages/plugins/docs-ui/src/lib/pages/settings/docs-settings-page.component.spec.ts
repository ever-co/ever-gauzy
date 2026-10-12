/**
 * `@gauzy/ui-core/i18n`, `@gauzy/ui-core/core` and `@gauzy/ui-core/shared` are barrels
 * over the whole app: importing them pulls Akita's untranspiled ESM (and every shared
 * component) into the CommonJS test runtime. The page is constructed directly with
 * doubles — no `TestBed`.
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
jest.mock('@gauzy/ui-core/shared', () => ({ DeleteConfirmationComponent: class DeleteConfirmationComponent {} }));

import { of } from 'rxjs';
import { DocumentVisibilityEnum } from '@gauzy/contracts';
import { IDocumentSettings } from '../../models/docs-api.model';
import { DocsSettingsPageComponent } from './docs-settings-page.component';

const GIB = 1024 * 1024 * 1024;

/** A settings envelope shaped exactly like `DocumentSettingsService.getSettings()`. */
function settings(quotaBytes: number | undefined, usedBytes = 512 * 1024 * 1024): IDocumentSettings {
	return {
		defaults: {
			importToKnowledgeDefault: false,
			defaultVisibility: DocumentVisibilityEnum.ORGANIZATION,
			autoClassify: true,
			...(quotaBytes === undefined ? {} : { quotaBytes })
		},
		capabilities: {
			aiEnabled: true,
			vectorSearch: true,
			embeddingModel: 'text-embedding-3-small',
			maxFileSize: 50 * 1024 * 1024,
			acceptedTypes: ['pdf'],
			inboundEmailEnabled: false
		},
		...(quotaBytes === undefined
			? {}
			: {
					quota: {
						quotaBytes,
						usedBytes,
						remainingBytes: quotaBytes ? Math.max(0, quotaBytes - usedBytes) : null,
						unlimited: quotaBytes === 0
					}
				})
	};
}

function createPage(initial: IDocumentSettings, updated: IDocumentSettings = initial) {
	const documentsService = {
		getSettings: jest.fn(() => of(initial)),
		getKnowledgeStatus: jest.fn(() => of(null)),
		getCategories: jest.fn(() => of([])),
		updateSettings: jest.fn(() => of(updated))
	};
	const toastrService = { success: jest.fn(), danger: jest.fn() };
	const dialogService = { open: jest.fn(() => ({ onClose: of(null) })) };
	const store = { selectedOrganization: { id: 'org', tenantId: 'tenant' }, selectedOrganization$: of(null) };

	const page = new DocsSettingsPageComponent(
		{ instant: (key: string) => key } as never,
		documentsService as never,
		toastrService as never,
		dialogService as never,
		store as never
	);
	return { page, documentsService, toastrService };
}

/**
 * The regression this file exists for: the server answers `{ defaults, capabilities,
 * quota }` and the page read `settings.storage`, so `storage` was always `null` and the
 * whole usage card was `*ngIf`'d out on every deployment. The quota is also the ONE
 * writable field of that block (`DocumentSettingsDTO.quotaBytes`), and a number input
 * that never reaches the DTO is worse than no input at all.
 */
describe('DocsSettingsPageComponent — storage quota (spec 08 §5.7 / 10 §7.1 P4)', () => {
	it('renders the meter from the `quota` block the server actually sends', async () => {
		const { page } = createPage(settings(2 * GIB));

		await page.load();

		expect(page.storage).toEqual({ usedBytes: 512 * 1024 * 1024, quotaBytes: 2 * GIB });
		expect(page.storagePercent).toBe(25);
	});

	it('reports an unlimited organization without inventing a full bar', async () => {
		const { page } = createPage(settings(0));

		await page.load();

		expect(page.storage).toEqual({ usedBytes: 512 * 1024 * 1024, quotaBytes: null });
		expect(page.storagePercent).toBeNull();
	});

	it('hides the quota editor on a deployment that does not expose a writable quota', async () => {
		const { page } = createPage(settings(undefined));

		await page.load();

		// No `quota` block at all: no usage card, and nothing writable to offer.
		expect(page.storage).toBeNull();
		expect(page.canEditQuota).toBe(false);
		expect(page.quotaGib).toBeNull();
	});

	it('edits in GiB and sends `quotaBytes` in BYTES — the field the DTO whitelists', async () => {
		const { page, documentsService } = createPage(settings(2 * GIB), settings(5 * GIB));

		await page.load();
		expect(page.canEditQuota).toBe(true);
		expect(page.quotaGib).toBe(2);
		expect(page.quotaDirty).toBe(false);

		page.quotaGib = 5;
		expect(page.quotaDirty).toBe(true);
		await page.saveQuota();

		// `PUT /settings` runs `forbidNonWhitelisted` — only real DTO fields may be sent.
		expect(documentsService.updateSettings).toHaveBeenCalledWith({ quotaBytes: 5 * GIB });
	});

	it('treats a cleared or zero field as "unlimited" rather than as a zero-byte quota', async () => {
		const { page, documentsService } = createPage(settings(2 * GIB), settings(0));

		await page.load();
		page.quotaGib = null;
		await page.saveQuota();

		expect(documentsService.updateSettings).toHaveBeenCalledWith({ quotaBytes: 0 });
	});

	it('re-normalizes the meter from the PUT response so it does not show the old limit', async () => {
		const { page } = createPage(settings(2 * GIB), settings(5 * GIB));

		await page.load();
		page.quotaGib = 5;
		await page.saveQuota();

		expect(page.storage).toEqual({ usedBytes: 512 * 1024 * 1024, quotaBytes: 5 * GIB });
	});
});
