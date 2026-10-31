import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogRef,
	NbIconLibraries,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { IChangelog } from '@gauzy/contracts';
import { ChangelogService, ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { ChangelogEntryComponent } from '@gauzy/ui-core/shared';
import {
	CHANGELOG_ADMIN_I18N,
	CHANGELOG_FIELD_MAX_LENGTH,
	IChangelogFormValue,
	httpUrlValidator,
	isForbidden,
	knownIconValidator,
	requiredTextValidator,
	toChangelogFormValue,
	toChangelogInput,
	toChangelogPreview
} from '../changelog-admin.utils';

/**
 * Adds or edits one What's New entry, with the card as it will look next to the form. The dialog saves the
 * entry itself and closes with the saved entry, so a refused or failed save keeps what was typed.
 */
@Component({
	selector: 'ga-changelog-entry-dialog',
	standalone: true,
	imports: [
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		TranslatePipe,
		ChangelogEntryComponent
	],
	templateUrl: './changelog-entry-dialog.component.html',
	styleUrls: ['./changelog-entry-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangelogEntryDialogComponent implements OnInit {
	/** The entry to edit; none adds one. Set through the dialog's context. */
	entry: IChangelog | null = null;

	readonly i18n = CHANGELOG_ADMIN_I18N;
	readonly maxLength = CHANGELOG_FIELD_MAX_LENGTH;

	form: FormGroup;
	preview: IChangelog;
	saving = false;

	constructor(
		private readonly _formBuilder: FormBuilder,
		private readonly _dialogRef: NbDialogRef<ChangelogEntryDialogComponent>,
		private readonly _changelogService: ChangelogService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _iconLibraries: NbIconLibraries,
		private readonly _cdr: ChangeDetectorRef
	) {}

	get isEdit(): boolean {
		return !!this.entry?.id;
	}

	ngOnInit(): void {
		const value = toChangelogFormValue(this.entry);
		const text = [requiredTextValidator, Validators.maxLength(this.maxLength)];
		const link = [httpUrlValidator, Validators.maxLength(this.maxLength)];
		this.form = this._formBuilder.group({
			title: [value.title, text],
			icon: [value.icon, [...text, knownIconValidator(this._isKnownIcon)]],
			date: [value.date, Validators.required],
			content: [value.content, text],
			learnMoreUrl: [value.learnMoreUrl, link],
			imageUrl: [value.imageUrl, link],
			isFeature: [value.isFeature]
		});
		this.preview = toChangelogPreview(value, this._isKnownIcon);
		this.form.valueChanges.subscribe((changed: IChangelogFormValue) => {
			this.preview = toChangelogPreview(changed, this._isKnownIcon);
			this._cdr.markForCheck();
		});
	}

	/**
	 * Whether the app can draw an icon of that name. When the icon registry cannot tell (no default pack), the
	 * name is let through rather than every icon refused.
	 */
	private readonly _isKnownIcon = (name: string): boolean => {
		try {
			return !!this._iconLibraries.getIcon(name);
		} catch {
			return true;
		}
	};

	/** Whether the field holds something the API will not take, once the user has been at it. */
	invalid(name: keyof IChangelogFormValue): boolean {
		const control = this.form.get(name);
		return !!control && control.invalid && (control.touched || control.dirty);
	}

	async save(): Promise<void> {
		if (this.saving) {
			return;
		}
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			this._cdr.markForCheck();
			return;
		}
		this.saving = true;
		this._cdr.markForCheck();
		const input = toChangelogInput(this.form.getRawValue());
		try {
			const saved = await firstValueFrom(
				this.isEdit ? this._changelogService.update(this.entry.id, input) : this._changelogService.create(input)
			);
			this._dialogRef.close(saved || { ...this.entry, ...input });
		} catch (error) {
			if (isForbidden(error)) {
				this._toastrService.danger(`${this.i18n}.FORBIDDEN`);
			} else {
				this._errorHandlingService.handleError(error);
			}
		} finally {
			this.saving = false;
			this._cdr.markForCheck();
		}
	}

	/**
	 * Closes without saving. Not while a save is under way: the dialog would close as if nothing was saved,
	 * the page would not show the entry once it is, and adding it again would make a duplicate.
	 */
	cancel(): void {
		if (this.saving) {
			return;
		}
		this._dialogRef.close();
	}

	/** Escape closes the form as Cancel does (the page opens it with the dialog's own Escape handling off). */
	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.cancel();
	}
}
