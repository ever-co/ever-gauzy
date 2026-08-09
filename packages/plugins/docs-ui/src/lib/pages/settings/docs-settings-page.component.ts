import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbIconModule,
	NbInputModule,
	NbProgressBarModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsModule } from 'ngx-permissions';
import { catchError, filter, firstValueFrom, of, tap } from 'rxjs';
import { DocumentVisibilityEnum, ID, IDocumentCategory, PermissionsEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';
import { CategoryDialogComponent, IDocsCategoryDialogResult } from '../../dialogs/category-dialog.component';
import { CategoryMergeDialogComponent } from '../../dialogs/category-merge-dialog.component';
import {
	IDocumentSettings,
	IDocumentSettingsDefaults,
	IDocumentSettingsStorage,
	IKnowledgeStatus,
	normalizeDocumentStorage
} from '../../models/docs-api.model';
import { DocumentsService } from '../../services/documents.service';

/** Catalog rows carry a `documentCount` projection the shared entity does not declare. */
type DocsCategoryRow = IDocumentCategory & { documentCount?: number };

/**
 * Divisor for the quota editor. The wire field is bytes (`@IsInt() @Min(0)`), but an
 * org quota is a GiB-scale number and nobody should have to type ten digits — the
 * field edits GiB and converts on the way in and out.
 */
const BYTES_PER_GIB = 1024 * 1024 * 1024;

/**
 * Documents settings page, registered at the `settings-sections` location so it
 * renders inside the core settings shell (`04-frontend-plugin.md` §2.1).
 *
 * Three blocks:
 *  1. Knowledge status banner — `GET /knowledge/status` (`vectorCapable`,
 *     `embeddingProviderConfigured`, `embeddingModel`); purely informational and
 *     silent on failure, so a deployment without the AI stack never shows an error.
 *  2. Org defaults — the writable block of `GET/PUT /settings`
 *     (`importToKnowledgeDefault`, `autoClassify`, `defaultVisibility`).
 *     `capabilities` is read-only by contract and is never sent back.
 *  3. Category catalog — full CRUD + merge (`DOCS_MANAGE`).
 *
 * Standalone + lazily loaded: it provides its own `DocumentsService` because it
 * lives outside `DocsUiModule`'s injector.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-settings-page',
	imports: [
		CommonModule,
		FormsModule,
		TranslateModule,
		NgxPermissionsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbProgressBarModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule
	],
	providers: [DocumentsService],
	templateUrl: './docs-settings-page.component.html',
	styleUrls: ['./docs-settings-page.component.scss']
})
export class DocsSettingsPageComponent extends TranslationBaseComponent implements OnInit {
	public settings: IDocumentSettings | null = null;
	public knowledge: IKnowledgeStatus | null = null;
	public categories: DocsCategoryRow[] = [];

	public loading = false;
	public savingDefaults = false;
	public loadError = false;

	public readonly permissions = PermissionsEnum;
	public readonly visibilities = [DocumentVisibilityEnum.ORGANIZATION, DocumentVisibilityEnum.PRIVATE];

	constructor(
		public readonly translateService: TranslateService,
		private readonly documentsService: DocumentsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				distinctUntilChange(),
				tap(() => void this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ─── Loading ─────────────────────────────────────────────────

	async load(): Promise<void> {
		this.loading = true;
		this.loadError = false;
		try {
			// Only the settings call is load-bearing: the knowledge probe and the
			// catalog degrade to "unknown"/empty rather than failing the page.
			const [settings, knowledge, categories] = await Promise.all([
				firstValueFrom(this.documentsService.getSettings()),
				firstValueFrom(this.documentsService.getKnowledgeStatus().pipe(catchError(() => of(null)))),
				firstValueFrom(this.documentsService.getCategories().pipe(catchError(() => of([]))))
			]);
			this.settings = settings;
			this.storage = normalizeDocumentStorage(settings);
			this.quotaGib = this.toGib(settings?.defaults?.quotaBytes);
			this.knowledge = knowledge;
			this.categories = (categories ?? []) as DocsCategoryRow[];
		} catch {
			this.loadError = true;
			this.settings = null;
			this.storage = null;
			this.quotaGib = null;
		} finally {
			this.loading = false;
		}
	}

	// ─── Org defaults ────────────────────────────────────────────

	get defaults(): IDocumentSettingsDefaults | null {
		return this.settings?.defaults ?? null;
	}

	/**
	 * Partial PUT of the defaults block only — `capabilities` and the computed
	 * `quota` usage numbers are never writable.
	 *
	 * The response is re-normalized into {@link storage}: a `quotaBytes` write moves
	 * the meter, and rebinding only `settings` would leave the card showing the old
	 * limit until the next full page load.
	 */
	async saveDefaults(partial: Partial<IDocumentSettingsDefaults>): Promise<void> {
		if (!this.settings || this.savingDefaults) return;
		const previous = this.settings;
		const previousStorage = this.storage;
		// Optimistic: the toggles must not lag a round trip.
		this.settings = { ...previous, defaults: { ...previous.defaults, ...partial } };
		this.savingDefaults = true;
		try {
			this.settings = await firstValueFrom(this.documentsService.updateSettings(partial));
			this.storage = normalizeDocumentStorage(this.settings);
			this.quotaGib = this.toGib(this.settings?.defaults?.quotaBytes);
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.UPDATED'));
		} catch (error) {
			this.settings = previous; // revert
			this.storage = previousStorage;
			this.quotaGib = this.toGib(previous?.defaults?.quotaBytes);
			this.toastrService.danger(error);
		} finally {
			this.savingDefaults = false;
		}
	}

	onImportDefaultToggle(importToKnowledgeDefault: boolean): void {
		void this.saveDefaults({ importToKnowledgeDefault });
	}

	onAutoClassifyToggle(autoClassify: boolean): void {
		void this.saveDefaults({ autoClassify });
	}

	onDefaultVisibilityChange(defaultVisibility: DocumentVisibilityEnum): void {
		void this.saveDefaults({ defaultVisibility });
	}

	// ─── Storage usage (P1 quota, spec 08 §5.7) ──────────────────

	/**
	 * `null` on any deployment that does not report usage — the whole card is
	 * hidden then, rather than showing an invented "0 bytes used".
	 *
	 * Held as a field, not a getter: the template binds it through `*ngIf ... as`
	 * and a getter would allocate a fresh object on every change-detection pass.
	 */
	public storage: IDocumentSettingsStorage | null = null;

	/** `null` when the quota is unlimited — there is no meaningful percentage. */
	get storagePercent(): number | null {
		const storage = this.storage;
		if (!storage?.quotaBytes) return null;
		return Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100));
	}

	/** Bar color: ≥ 95 % danger, ≥ 80 % warning, otherwise informational. */
	get storageStatus(): 'danger' | 'warning' | 'info' {
		const percent = this.storagePercent ?? 0;
		if (percent >= 95) return 'danger';
		if (percent >= 80) return 'warning';
		return 'info';
	}

	// ─── Quota editor (the one writable quota field) ─────────────

	/**
	 * Bound to the quota input, in GiB; `0` = unlimited, `null` = the deployment
	 * does not expose a writable quota (the field is not rendered then).
	 */
	public quotaGib: number | null = null;

	/** True while the quota PUT is in flight — the field and its button are disabled. */
	public savingQuota = false;

	/**
	 * Whether this deployment reports a writable org quota at all.
	 *
	 * Keyed on `defaults.quotaBytes` — the field the PUT accepts — NOT on the
	 * computed usage block: a deployment can report usage without accepting a
	 * per-organization override, and an input bound to a field the server would
	 * strip is a control that silently does nothing.
	 */
	get canEditQuota(): boolean {
		return typeof this.settings?.defaults?.quotaBytes === 'number';
	}

	/** True once the field differs from what the server currently holds. */
	get quotaDirty(): boolean {
		if (!this.canEditQuota) return false;
		return this.toBytes(this.quotaGib) !== (this.settings?.defaults?.quotaBytes ?? 0);
	}

	/** Persists the quota through the shared defaults PUT (`quotaBytes`, bytes, `0` = unlimited). */
	async saveQuota(): Promise<void> {
		if (!this.canEditQuota || this.savingQuota || !this.quotaDirty) return;
		this.savingQuota = true;
		try {
			await this.saveDefaults({ quotaBytes: this.toBytes(this.quotaGib) });
		} finally {
			this.savingQuota = false;
		}
	}

	/** Bytes → GiB for the editor; `undefined` (unsupported) stays `null`. */
	private toGib(bytes: number | undefined | null): number | null {
		if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return null;
		if (bytes <= 0) return 0;
		// Two decimals keeps a 512 MiB quota editable without turning into 0.
		return Math.round((bytes / BYTES_PER_GIB) * 100) / 100;
	}

	/** GiB → bytes for the wire. Anything unusable (blank, negative, NaN) means unlimited. */
	private toBytes(gib: number | null): number {
		if (typeof gib !== 'number' || !Number.isFinite(gib) || gib <= 0) return 0;
		return Math.round(gib * BYTES_PER_GIB);
	}

	humanizeSize(bytes?: number | null): string {
		if (!bytes) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, exponent);
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	// ─── Categories ──────────────────────────────────────────────

	async createCategory(): Promise<void> {
		const result: IDocsCategoryDialogResult | null = await firstValueFrom(
			this.dialogService.open(CategoryDialogComponent).onClose
		);
		if (!result) return;
		try {
			// `CreateDocumentCategoryDTO` extends `TenantOrganizationBaseDTO`, which
			// REQUIRES `organizationId` — omitting it fails validation with a 400.
			const organization = this.store.selectedOrganization;
			await firstValueFrom(
				this.documentsService.createCategory({
					...result,
					organizationId: organization?.id,
					tenantId: organization?.tenantId
				})
			);
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.CREATED'));
			await this.reloadCategories();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async editCategory(category: DocsCategoryRow): Promise<void> {
		const result: IDocsCategoryDialogResult | null = await firstValueFrom(
			this.dialogService.open(CategoryDialogComponent, { context: { category } }).onClose
		);
		if (!result) return;
		try {
			await firstValueFrom(this.documentsService.updateCategory(category.id as ID, result));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.UPDATED'));
			await this.reloadCategories();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** System rows cannot be deleted (backend returns 409 `DOCS_CATEGORY_SYSTEM`). */
	async deleteCategory(category: DocsCategoryRow): Promise<void> {
		if (category.isSystem) return;
		const confirmed = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: { recordType: this.getTranslation('DOCS.SETTINGS.CATEGORIES') }
			}).onClose
		);
		if (!confirmed) return;
		try {
			await firstValueFrom(this.documentsService.deleteCategory(category.id as ID));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.DELETED'));
			await this.reloadCategories();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async mergeCategory(category: DocsCategoryRow): Promise<void> {
		const targets = this.categories.filter((row) => String(row.id) !== String(category.id));
		if (!targets.length) return;
		const targetId: ID | null = await firstValueFrom(
			this.dialogService.open(CategoryMergeDialogComponent, { context: { source: category, targets } }).onClose
		);
		if (!targetId) return;
		try {
			await firstValueFrom(this.documentsService.mergeCategory(category.id as ID, targetId));
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.UPDATED'));
			await this.reloadCategories();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	trackById(_: number, category: DocsCategoryRow): string {
		return String(category.id);
	}

	private async reloadCategories(): Promise<void> {
		this.categories = ((await firstValueFrom(
			this.documentsService.getCategories().pipe(catchError(() => of([])))
		)) ?? []) as DocsCategoryRow[];
	}
}
