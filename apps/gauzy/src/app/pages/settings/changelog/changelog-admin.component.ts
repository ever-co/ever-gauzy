import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbIconModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { DEFAULT_CHANGELOG_PLATFORM, IChangelog, ID } from '@gauzy/contracts';
import { ChangelogService, ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';
import {
	CHANGELOG_ADMIN_I18N,
	CHANGELOG_PLATFORM_OPTIONS,
	hasSignUpFeatures,
	isForbidden,
	sortChangelogEntries
} from './changelog-admin.utils';
import { ChangelogEntryDialogComponent } from './changelog-entry-dialog/changelog-entry-dialog.component';

/** One kind of entry, listed in its own section: the What's New panel's, or the sign-up page's cards. */
export interface IChangelogSection {
	isFeature: boolean;
	titleKey: string;
	hintKey: string;
	entries: IChangelog[];
}

/**
 * Settings > What's New: the installation-wide entries of the What's New panel and of the sign-up page's
 * feature cards, with add, edit, delete and, for what was deleted while the page is open, restore. Each kind
 * is read as its surface reads it (the newest twenty), and the list is read again after every change.
 *
 * The entries are kept per product: Gauzy's, and those of the Ever products that read their What's New from
 * this installation (Ever Teams, Ever Works, Ever Platform). The page shows one product at a time, and an entry
 * added while a product is shown belongs to it. Only Gauzy has a sign-up page with feature cards.
 */
@Component({
	selector: 'ga-changelog-admin',
	standalone: true,
	imports: [DatePipe, NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe],
	templateUrl: './changelog-admin.component.html',
	styleUrls: ['./changelog-admin.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangelogAdminComponent implements OnInit {
	readonly i18n = CHANGELOG_ADMIN_I18N;
	readonly platforms = CHANGELOG_PLATFORM_OPTIONS;

	/** The product whose entries the page shows, and whom an added entry belongs to. */
	platform: string = DEFAULT_CHANGELOG_PLATFORM;

	sections: IChangelogSection[] = this._sectionsOf(DEFAULT_CHANGELOG_PLATFORM);
	/**
	 * Entries deleted while the page is open, newest first, which restore can bring back, each stamped with the
	 * product it was deleted from (the section shows the current product's only).
	 */
	deleted: IChangelog[] = [];
	/**
	 * Whether the API keeps entries per product: known once it returns rows (theirs carry a `platform`). An API
	 * from before products existed ignores the product and returns Gauzy's entries for every query, so the other
	 * products are turned off rather than listing, and letting the operator change, Gauzy's news under their name.
	 */
	platformsSupported: boolean | null = null;
	loading = false;
	loadFailed = false;
	/** The entry a delete or restore is under way for. */
	busyId: ID | null = null;

	/** Bumped by every read, so an older read finishing late cannot overwrite a newer one. */
	private _sequence = 0;

	constructor(
		private readonly _changelogService: ChangelogService,
		private readonly _dialogService: NbDialogService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _cdr: ChangeDetectorRef
	) {}

	ngOnInit(): void {
		this.load();
	}

	async load(): Promise<void> {
		const sequence = ++this._sequence;
		this.loading = true;
		this.loadFailed = false;
		this._cdr.markForCheck();
		try {
			// Gauzy's entries are read as every Gauzy surface reads them, naming no product (the API's default),
			// so the page also works against an API from before products existed.
			const product = this.platform === DEFAULT_CHANGELOG_PLATFORM ? {} : { platform: this.platform };
			const pages = await Promise.all(
				this.sections.map(({ isFeature }) =>
					firstValueFrom(this._changelogService.find({ isFeature: isFeature ? 1 : 0, ...product }))
				)
			);
			if (sequence !== this._sequence) {
				return;
			}
			const rows = pages.flatMap((page) => page?.items ?? []);
			if (rows.some((row) => !row.platform)) {
				this.platformsSupported = false;
			} else if (rows.length) {
				this.platformsSupported = true;
			}
			// Gauzy's view takes what the API returns (the default product); another product's view shows only rows
			// that name it, never the Gauzy rows an older API answers with.
			const isGauzy = this.platform === DEFAULT_CHANGELOG_PLATFORM;
			this.sections = this.sections.map((section, index) => ({
				...section,
				entries: sortChangelogEntries(
					(pages[index]?.items ?? []).filter((item) => isGauzy || item.platform === this.platform)
				)
			}));
		} catch {
			if (sequence === this._sequence) {
				this.loadFailed = true;
			}
		} finally {
			if (sequence === this._sequence) {
				this.loading = false;
				this._cdr.markForCheck();
			}
		}
	}

	/** The entries deleted from the product shown. */
	get deletedHere(): IChangelog[] {
		return this.deleted.filter((entry) => (entry.platform || DEFAULT_CHANGELOG_PLATFORM) === this.platform);
	}

	/** Whether a product can be picked: Gauzy always; the others once the API is known to keep products apart. */
	isPlatformAvailable(platform: string): boolean {
		return platform === DEFAULT_CHANGELOG_PLATFORM || this.platformsSupported !== false;
	}

	/**
	 * Whether an entry can be added for the product shown. Gauzy always; another product only once the API has
	 * shown it keeps products apart (its rows name their product): an API from before products existed would
	 * store the entry with no product, and so publish it as Gauzy news. With no rows yet, that is not known.
	 */
	get canAdd(): boolean {
		return this.platform === DEFAULT_CHANGELOG_PLATFORM || this.platformsSupported === true;
	}

	/** Shows another product's entries. */
	selectPlatform(platform: string): void {
		if (
			platform === this.platform ||
			!this.platforms.some(({ key }) => key === platform) ||
			!this.isPlatformAvailable(platform)
		) {
			return;
		}
		this.platform = platform;
		this.sections = this._sectionsOf(platform);
		this.load();
	}

	/** Adds an entry of the section's kind, for the product shown. */
	add(section: IChangelogSection): void {
		if (!this.canAdd) {
			return;
		}
		this._openDialog({ isFeature: section.isFeature, platform: this.platform });
	}

	edit(entry: IChangelog): void {
		// An API from before products existed returns no product: the entry is the one shown.
		this._openDialog({ ...entry, platform: entry.platform || this.platform });
	}

	async remove(entry: IChangelog): Promise<void> {
		if (this.busyId) {
			return;
		}
		// The product the entry was listed under, kept even if the operator switches product while it deletes.
		const platform = entry.platform || this.platform;
		const dialog = this._dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: `"${entry.title}"`, isRecord: false }
		});
		if ((await firstValueFrom(dialog.onClose)) !== 'ok') {
			return;
		}
		const done = await this._change(entry, () => this._changelogService.delete(entry.id), 'DELETED_MESSAGE');
		if (done) {
			this.deleted = [{ ...entry, platform }, ...this.deleted.filter(({ id }) => id !== entry.id)];
		}
		this._cdr.markForCheck();
	}

	async restore(entry: IChangelog): Promise<void> {
		if (this.busyId) {
			return;
		}
		const done = await this._change(entry, () => this._changelogService.recover(entry.id), 'RESTORED_MESSAGE');
		if (done) {
			this.deleted = this.deleted.filter(({ id }) => id !== entry.id);
		}
		this._cdr.markForCheck();
	}

	/** Opens the entry form; a saved entry reads the list again. */
	private _openDialog(entry: IChangelog): void {
		this._dialogService
			// The form closes itself on Cancel and Escape, but not while it saves; a click beside it never
			// closes it, so what was typed is not lost to a stray click.
			.open(ChangelogEntryDialogComponent, { context: { entry }, closeOnBackdropClick: false, closeOnEsc: false })
			.onClose.subscribe((saved?: IChangelog) => {
				if (saved) {
					this._toastrService.success(`${this.i18n}.SAVED_MESSAGE`);
					this.load();
				}
			});
	}

	/**
	 * Runs one delete or restore and reads the list again. A refusal says only the installation's operator may
	 * change the entries; other failures show the API's message. Resolves whether the change went through.
	 */
	private async _change(entry: IChangelog, run: () => ReturnType<ChangelogService['delete']>, messageKey: string) {
		this.busyId = entry.id;
		this._cdr.markForCheck();
		try {
			await firstValueFrom(run());
			this._toastrService.success(`${this.i18n}.${messageKey}`);
			this.load();
			return true;
		} catch (error) {
			if (isForbidden(error)) {
				this._toastrService.danger(`${this.i18n}.FORBIDDEN`);
			} else {
				this._errorHandlingService.handleError(error);
			}
			return false;
		} finally {
			this.busyId = null;
		}
	}

	/** The lists a product has: its What's New entries, and for Gauzy its sign-up page's cards too. */
	private _sectionsOf(platform: string): IChangelogSection[] {
		const sections = [this._section(false, 'WHATS_NEW')];
		if (hasSignUpFeatures(platform)) {
			sections.push(this._section(true, 'FEATURES'));
		}
		return sections;
	}

	private _section(isFeature: boolean, key: string): IChangelogSection {
		return {
			isFeature,
			titleKey: `${CHANGELOG_ADMIN_I18N}.${key}`,
			hintKey: `${CHANGELOG_ADMIN_I18N}.${key}_HINT`,
			entries: []
		};
	}
}
