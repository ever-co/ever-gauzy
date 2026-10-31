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
import { IChangelog, ID } from '@gauzy/contracts';
import { ChangelogService, ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';
import { CHANGELOG_ADMIN_I18N, isForbidden, sortChangelogEntries } from './changelog-admin.utils';
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

	sections: IChangelogSection[] = [this._section(false, 'WHATS_NEW'), this._section(true, 'FEATURES')];
	/** Entries deleted while the page is open, newest first, which restore can bring back. */
	deleted: IChangelog[] = [];
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
			const pages = await Promise.all(
				this.sections.map(({ isFeature }) =>
					firstValueFrom(this._changelogService.find({ isFeature: isFeature ? 1 : 0 }))
				)
			);
			if (sequence !== this._sequence) {
				return;
			}
			this.sections = this.sections.map((section, index) => ({
				...section,
				entries: sortChangelogEntries(pages[index]?.items)
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

	/** Adds an entry of the section's kind. */
	add(section: IChangelogSection): void {
		this._openDialog({ isFeature: section.isFeature });
	}

	edit(entry: IChangelog): void {
		this._openDialog(entry);
	}

	async remove(entry: IChangelog): Promise<void> {
		if (this.busyId) {
			return;
		}
		const dialog = this._dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: `"${entry.title}"`, isRecord: false }
		});
		if ((await firstValueFrom(dialog.onClose)) !== 'ok') {
			return;
		}
		const done = await this._change(entry, () => this._changelogService.delete(entry.id), 'DELETED_MESSAGE');
		if (done) {
			this.deleted = [entry, ...this.deleted.filter(({ id }) => id !== entry.id)];
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

	private _section(isFeature: boolean, key: string): IChangelogSection {
		return {
			isFeature,
			titleKey: `${CHANGELOG_ADMIN_I18N}.${key}`,
			hintKey: `${CHANGELOG_ADMIN_I18N}.${key}_HINT`,
			entries: []
		};
	}
}
