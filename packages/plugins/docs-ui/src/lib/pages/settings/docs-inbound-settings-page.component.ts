import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsModule } from 'ngx-permissions';
import { catchError, filter, firstValueFrom, of, tap } from 'rxjs';
import {
	DocumentInboundAddressKindEnum,
	DocumentInboundDomainStatusEnum,
	ID,
	IDocumentInboundAddressSecret,
	IDocumentInboundAddressUpdateInput,
	IDocumentInboundDomainVerification,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	IDocsInboundDomainDialogResult,
	InboundDomainDialogComponent
} from '../../dialogs/inbound-domain-dialog.component';
import { InboundSecretDialogComponent } from '../../dialogs/inbound-secret-dialog.component';
import { IDocumentSettingsCapabilities } from '../../models/docs-api.model';
import {
	DOCS_INBOUND_ALLOWLIST_MAX,
	DOCS_INBOUND_STATUS_BADGES,
	DOCS_INBOUND_STATUS_HINT_KEYS,
	DOCS_INBOUND_STATUS_LABEL_KEYS,
	IDocumentInboundAddressView,
	normalizeInboundAllowlistEntry,
	sameInboundAllowlist
} from '../../models/docs-inbound.model';
import { DocumentInboundAddressService } from '../../services/document-inbound-address.service';
import { DocumentsService } from '../../services/documents.service';
import { DOCS_PERMISSIONS } from '../../docs-permission-groups';

/** Which destructive action a row is currently asking the user to confirm. */
export type DocsInboundConfirm = 'secret' | 'address' | null;

/**
 * View row: one capture address plus everything the card needs to edit it.
 *
 * 🛑 Every array on this object is a **field whose identity changes only when its contents
 * change**. The template iterates `allowlist` directly, and a getter that rebuilt it per
 * change-detection pass is precisely what pegged the main thread in the filter bar
 * (`facet-multiselect.component.ts:52-64`).
 */
export interface IDocsInboundAddressRow {
	/** The wire row. Replaced wholesale on every mutation so `[checked]` bindings re-evaluate. */
	address: IDocumentInboundAddressView;
	/** `GET /:id/verification`; `null` for a PLATFORM row or when the probe failed. */
	verification: IDocumentInboundDomainVerification | null;
	/** Allowlist draft. Empty means "any sender that passes SPF/DKIM". */
	allowlist: string[];
	/** True once the draft differs from what the server holds — gates the Save button. */
	allowlistDirty: boolean;
	/** Bound to the "add entry" input. */
	allowlistEntry: string;
	/** Per-row in-flight guard, so one rotation does not freeze every other card. */
	busy: boolean;
	/** Inline two-step confirmation for the two irreversible actions. */
	confirm: DocsInboundConfirm;
	/**
	 * Stable `ngTemplateOutlet` context for the shared controls block.
	 *
	 * Built once in {@link DocsInboundSettingsPageComponent.toRow} rather than written inline as
	 * `context: { $implicit: row }`: an object literal in a template allocates a fresh context on
	 * every change-detection pass, which is the same identity churn that wedged the filter bar.
	 */
	context: { $implicit: IDocsInboundAddressRow };
}

/**
 * Inbound email capture settings, registered at the `settings-sections` location so it renders
 * inside the core settings shell alongside the main Documents settings page.
 *
 * Two blocks, mirroring the two kinds of address (spec 07 §17.2):
 *
 *  1. **Shared address** (`PLATFORM`) — minted automatically by the server on first read. The
 *     address itself is the credential, so it is shown read-only with a copy button and can only
 *     be *rotated*, never edited. An empty list means the deployment has no inbound domain
 *     configured and there was nothing to mint — said plainly rather than shown as an error.
 *  2. **Tenant domains** (`CUSTOM_DOMAIN`) — added here, each with its DNS TXT record, a verify
 *     button and a status. Mail is REJECTED until the record verifies, and a `FAILED` row means
 *     a record that once verified has since disappeared; both facts are stated on the card,
 *     because "PENDING" on its own does not tell an administrator that mail is bouncing.
 *
 * Both kinds share the sender allowlist, the body-import preference and the active flag.
 *
 * 🛑 **The relay secret is returned exactly once** — on create and on rotate. It is handed
 * straight to {@link InboundSecretDialogComponent} and never stored on this component, in a
 * store, or in a toast.
 *
 * Standalone + lazily loaded: it provides its own services because it lives outside
 * `DocsUiModule`'s injector.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-inbound-settings-page',
	imports: [
		CommonModule,
		FormsModule,
		TranslateModule,
		NgxPermissionsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule
	],
	providers: [DocumentInboundAddressService, DocumentsService],
	templateUrl: './docs-inbound-settings-page.component.html',
	styleUrls: ['./docs-inbound-settings-page.component.scss']
})
export class DocsInboundSettingsPageComponent extends TranslationBaseComponent implements OnInit {
	/**
	 * Stable permission arrays for the template's `*ngxPermissionsOnly` gates.
	 * 🛑 Never inline `[permissions.X]` in a binding — a fresh array each change-detection cycle
	 * makes ngx-permissions re-validate forever and wedges the main thread.
	 */
	public readonly docsPermissions = DOCS_PERMISSIONS;

	/** The organization's PLATFORM row, or `null` when the deployment mints none. */
	public platform: IDocsInboundAddressRow | null = null;

	/**
	 * The organization's CUSTOM_DOMAIN rows.
	 *
	 * A field, not a getter: the template iterates it and a getter would hand `*ngFor` a fresh
	 * array on every change-detection pass.
	 */
	public customDomains: IDocsInboundAddressRow[] = [];

	/** Deployment capabilities from `GET /settings` — used only for the "capture is off" banner. */
	public capabilities: IDocumentSettingsCapabilities | null = null;

	public loading = false;
	public loadError = false;
	/** True once the list answered 404 — this deployment predates the capture endpoints. */
	public unsupported = false;
	/** True while `POST /inbound-addresses` is in flight. */
	public adding = false;

	public readonly permissions = PermissionsEnum;
	public readonly kinds = DocumentInboundAddressKindEnum;
	public readonly statuses = DocumentInboundDomainStatusEnum;
	public readonly allowlistMax = DOCS_INBOUND_ALLOWLIST_MAX;

	constructor(
		public readonly translateService: TranslateService,
		private readonly inboundService: DocumentInboundAddressService,
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
		this.unsupported = false;
		try {
			// Only the address list is load-bearing. The capabilities probe drives one advisory
			// banner and degrades to "unknown" rather than failing the page.
			const [addresses, settings] = await Promise.all([
				firstValueFrom(this.inboundService.getAll()),
				firstValueFrom(this.documentsService.getSettings().pipe(catchError(() => of(null))))
			]);
			this.capabilities = settings?.capabilities ?? null;
			await this.project(addresses ?? []);
		} catch (error) {
			// A 404 means the endpoints are not deployed — a notice, not an error the user can
			// act on (`share-dialog.component.ts` treats the P1 share routes the same way).
			if ((error as { status?: number })?.status === 404) {
				this.unsupported = true;
			} else {
				this.loadError = true;
			}
			this.platform = null;
			this.customDomains = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Splits the wire rows into the two cards and fetches each custom domain's DNS record.
	 *
	 * One extra call per custom domain — a handful at most, and the record is only authoritative
	 * server-side (the `_gauzy-docs` prefix is a backend constant). A failed probe leaves that
	 * row's `verification` at `null`, which the template renders as "record unavailable" instead
	 * of failing the whole page.
	 */
	private async project(addresses: IDocumentInboundAddressView[]): Promise<void> {
		const rows = addresses.map((address) => this.toRow(address));
		await Promise.all(
			rows
				.filter((row) => row.address.kind === DocumentInboundAddressKindEnum.CUSTOM_DOMAIN && !!row.address.id)
				.map(async (row) => {
					row.verification = await firstValueFrom(
						this.inboundService
							.getVerification(row.address.id as ID)
							.pipe(catchError(() => of(null as IDocumentInboundDomainVerification | null)))
					);
				})
		);
		this.platform = rows.find((row) => row.address.kind === DocumentInboundAddressKindEnum.PLATFORM) ?? null;
		this.customDomains = rows.filter((row) => row.address.kind === DocumentInboundAddressKindEnum.CUSTOM_DOMAIN);
	}

	/** Wire row → view row. The allowlist is copied so editing never mutates the response. */
	private toRow(address: IDocumentInboundAddressView): IDocsInboundAddressRow {
		const row = {
			address,
			verification: null,
			allowlist: [...(address.senderAllowlist ?? [])],
			allowlistDirty: false,
			allowlistEntry: '',
			busy: false,
			confirm: null
		} as IDocsInboundAddressRow;
		// Self-referential and built exactly once — see `IDocsInboundAddressRow.context`.
		row.context = { $implicit: row };
		return row;
	}

	// ─── Toggles (PUT /:id) ──────────────────────────────────────

	onImportBodyToggle(row: IDocsInboundAddressRow, importBodyAsNote: boolean): void {
		void this.patch(row, { importBodyAsNote });
	}

	onActiveToggle(row: IDocsInboundAddressRow, isActive: boolean): void {
		void this.patch(row, { isActive });
	}

	/**
	 * Partial update of one address.
	 *
	 * Optimistic, and it must be: `nb-toggle` is bound through `[checked]`, so if the row were
	 * left untouched while the request flew, the binding value would not change and Angular
	 * would never push the old state back — a failed save would leave a toggle showing the
	 * opposite of what the server holds. The snapshot is restored on error for the same reason
	 * (`docs-settings-page.component.ts:161-181`).
	 */
	private async patch(row: IDocsInboundAddressRow, input: IDocumentInboundAddressUpdateInput): Promise<void> {
		if (row.busy || !row.address.id) return;
		const previous = row.address;
		row.address = { ...previous, ...input };
		row.busy = true;
		try {
			row.address = await firstValueFrom(this.inboundService.update(previous.id as ID, input));
			// Adopt the server's echo of the allowlist only when this call was ABOUT the
			// allowlist; a toggle save must not silently discard an unsaved draft.
			this.syncAllowlist(row, input.senderAllowlist !== undefined);
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.UPDATED'));
		} catch (error) {
			row.address = previous; // revert
			this.syncAllowlist(row, false);
			this.toastrService.danger(error);
		} finally {
			row.busy = false;
		}
	}

	// ─── Sender allowlist ────────────────────────────────────────

	/**
	 * Can the typed entry be added? Guards the Add button and is re-checked in
	 * {@link addAllowlistEntry} — Enter reaches the handler without the button.
	 */
	canAddAllowlistEntry(row: IDocsInboundAddressRow): boolean {
		if (row.busy || row.allowlist.length >= DOCS_INBOUND_ALLOWLIST_MAX) return false;
		const entry = normalizeInboundAllowlistEntry(row.allowlistEntry);
		return !!entry && !row.allowlist.includes(entry);
	}

	addAllowlistEntry(row: IDocsInboundAddressRow): void {
		const entry = normalizeInboundAllowlistEntry(row.allowlistEntry);
		if (!entry || !this.canAddAllowlistEntry(row)) return;
		// A NEW array — but only here, where the contents genuinely changed. `*ngFor` re-renders
		// on identity, so rebuilding this anywhere else would re-render the chips continuously.
		row.allowlist = [...row.allowlist, entry];
		row.allowlistEntry = '';
		this.syncAllowlist(row, false);
	}

	removeAllowlistEntry(row: IDocsInboundAddressRow, entry: string): void {
		if (row.busy) return;
		row.allowlist = row.allowlist.filter((candidate) => candidate !== entry);
		this.syncAllowlist(row, false);
	}

	/**
	 * Persists the draft.
	 *
	 * An empty array is sent as an empty array, not omitted: that is how the list is *cleared*,
	 * and the server reads a cleared list as "accept any sender that passes SPF/DKIM".
	 */
	async saveAllowlist(row: IDocsInboundAddressRow): Promise<void> {
		if (!row.allowlistDirty) return;
		await this.patch(row, { senderAllowlist: row.allowlist });
	}

	/**
	 * Re-derives {@link IDocsInboundAddressRow.allowlistDirty} against the server's value.
	 *
	 * @param adopt When true, the draft is replaced by the server's list (after a successful
	 * allowlist save). Otherwise the draft is left alone and only the dirty flag is recomputed —
	 * so adding an entry and removing it again correctly reads as clean.
	 */
	private syncAllowlist(row: IDocsInboundAddressRow, adopt: boolean): void {
		const saved = row.address.senderAllowlist ?? [];
		if (adopt) {
			row.allowlist = [...saved];
		}
		row.allowlistDirty = !sameInboundAllowlist(row.allowlist, saved);
	}

	// ─── Domain verification ─────────────────────────────────────

	/**
	 * Re-checks the TXT record.
	 *
	 * 🛑 A missing record is a **200**, not a failure: the endpoint answers with the unchanged
	 * (or degraded) status plus a `message`. Reading the status rather than assuming success is
	 * the whole point — a `catch`-only implementation would report "verified" for every failure.
	 */
	async verify(row: IDocsInboundAddressRow): Promise<void> {
		if (row.busy || !row.address.id) return;
		row.busy = true;
		try {
			const verification = await firstValueFrom(this.inboundService.verify(row.address.id as ID));
			row.verification = verification;
			// The badge and the "mail is rejected" copy read the row, not the descriptor, so the
			// status has to land on both or the card would contradict itself.
			row.address = {
				...row.address,
				domainStatus: verification.status,
				domainVerifiedAt: verification.verifiedAt ?? null,
				domainLastCheckedAt: verification.lastCheckedAt ?? null
			};
			if (verification.status === DocumentInboundDomainStatusEnum.VERIFIED) {
				this.toastrService.success(this.getTranslation('DOCS.INBOUND.TOAST_VERIFIED'));
			} else {
				// Not an error — DNS simply has not propagated yet. The server says why.
				this.toastrService.warning(
					verification.message || this.getTranslation('DOCS.INBOUND.TOAST_NOT_VERIFIED')
				);
			}
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			row.busy = false;
		}
	}

	// ─── Adding a tenant domain ──────────────────────────────────

	async addDomain(): Promise<void> {
		if (this.adding) return;
		const result: IDocsInboundDomainDialogResult | null = await firstValueFrom(
			this.dialogService.open(InboundDomainDialogComponent).onClose
		);
		if (!result) return;

		this.adding = true;
		try {
			const created = await firstValueFrom(this.inboundService.create(result));
			// 🛑 Before anything else. `created.secret` is the only copy of the relay secret that
			// will ever exist; a reload or a navigation between here and the reveal destroys it.
			await this.revealSecret(created.secret);
			this.toastrService.success(this.getTranslation('DOCS.INBOUND.TOAST_ADDED'));
			await this.load();
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.adding = false;
		}
	}

	// ─── Rotation (inline two-step confirm) ──────────────────────

	/** Arms the inline confirmation strip for one irreversible action. */
	askConfirm(row: IDocsInboundAddressRow, confirm: DocsInboundConfirm): void {
		row.confirm = row.busy ? null : confirm;
	}

	cancelConfirm(row: IDocsInboundAddressRow): void {
		row.confirm = null;
	}

	/**
	 * Issues a new relay secret. The previous one stops working immediately, so the relay has to
	 * be updated with the value the dialog shows — which is why the warning is stated inline,
	 * before the click, rather than only in the reveal dialog afterwards.
	 *
	 * Offered for `CUSTOM_DOMAIN` only. A `PLATFORM` row has no per-address secret — deliveries to
	 * it are authenticated by the deployment-wide relay signature instead.
	 *
	 * 🛑 Not because rotating one would *break* capture: the webhook gate is an OR
	 * (`inbound-email.service.ts` — `if (!globalSignatureOk && !perAddressSecretOk) throw`), so an
	 * address secret on a PLATFORM row leaves the global signature working. It is hidden because
	 * it would be **inert**: the platform relay never sends the per-address secret header, so the
	 * button would hand out a one-time secret that nothing ever presents — a credential the user
	 * is told to store and act on, which in fact does nothing.
	 */
	async rotateSecret(row: IDocsInboundAddressRow): Promise<void> {
		row.confirm = null;
		if (row.busy || !row.address.id) return;
		row.busy = true;
		try {
			const secret: IDocumentInboundAddressSecret = await firstValueFrom(
				this.inboundService.rotateSecret(row.address.id as ID)
			);
			await this.revealSecret(secret);
			this.toastrService.success(this.getTranslation('DOCS.INBOUND.TOAST_SECRET_ROTATED'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			row.busy = false;
		}
	}

	/**
	 * Mints a new PLATFORM address. The old one stops resolving at once — anything still mailing
	 * it will bounce — so this is a two-step action with the consequence spelled out.
	 */
	async rotateAddress(row: IDocsInboundAddressRow): Promise<void> {
		row.confirm = null;
		if (row.busy || !row.address.id) return;
		row.busy = true;
		try {
			row.address = await firstValueFrom(this.inboundService.rotateAddress(row.address.id as ID));
			this.syncAllowlist(row, true);
			this.toastrService.success(this.getTranslation('DOCS.INBOUND.TOAST_ADDRESS_ROTATED'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			row.busy = false;
		}
	}

	/**
	 * Puts the one-time secret in front of the user and waits for the acknowledgement.
	 *
	 * `closeOnEsc`/`closeOnBackdropClick` are off on purpose: the plaintext cannot be asked for
	 * again, so a reflexive Esc must not be able to throw it away.
	 */
	private async revealSecret(secret: IDocumentInboundAddressSecret): Promise<void> {
		await firstValueFrom(
			this.dialogService.open(InboundSecretDialogComponent, {
				context: { secret },
				closeOnEsc: false,
				closeOnBackdropClick: false
			}).onClose
		);
	}

	// ─── Clipboard ───────────────────────────────────────────────

	/**
	 * Copies a value and confirms with a toast.
	 *
	 * A denied clipboard permission is swallowed, as everywhere else in this package
	 * (`docs-row-actions.service.ts:232-240`): every value copied here is also selectable on
	 * screen, so a failure leaves the user no worse off and nothing to roll back.
	 */
	async copy(value: string | null | undefined, messageKey: string): Promise<void> {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			this.toastrService.success(this.getTranslation(messageKey));
		} catch {
			// Clipboard permission denied / unavailable — nothing to roll back.
		}
	}

	// ─── Template helpers ────────────────────────────────────────

	statusLabelKey(status?: DocumentInboundDomainStatusEnum): string {
		return DOCS_INBOUND_STATUS_LABEL_KEYS[status as DocumentInboundDomainStatusEnum] ?? 'DOCS.INBOUND.STATUS_PENDING';
	}

	statusHintKey(status?: DocumentInboundDomainStatusEnum): string {
		return (
			DOCS_INBOUND_STATUS_HINT_KEYS[status as DocumentInboundDomainStatusEnum] ??
			'DOCS.INBOUND.STATUS_PENDING_HINT'
		);
	}

	statusBadge(status?: DocumentInboundDomainStatusEnum): 'warning' | 'success' | 'danger' {
		return DOCS_INBOUND_STATUS_BADGES[status as DocumentInboundDomainStatusEnum] ?? 'warning';
	}

	trackByRowId(_: number, row: IDocsInboundAddressRow): string {
		return String(row.address.id);
	}

	/** Entries are unique within a list (duplicates are refused on add), so the value is the key. */
	trackByEntry(_: number, entry: string): string {
		return entry;
	}
}
