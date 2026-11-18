import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, UntypedFormGroup, UntypedFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { NbDialogRef, NbThemeService } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ITag, ITagType } from '@gauzy/contracts';
import { Store, TagTypesService, ToastrService } from '@gauzy/ui-core/core';
import { TagsService } from '@gauzy/ui-core/core';
import { NotesWithTagsComponent } from '../table-components';

/**
 * The colour strings the picker's own parser reads with the alpha channel disabled (ngx-color-picker 20,
 * `ColorPickerService.stringToHsva`) that CSS can also paint: hex with 3 or 6 digits, `rgb(r, g, b[, a])` and
 * `hsl(h, s%, l%[, a])`. The picker reads no 4- or 8-digit hex here and no `hsv()`, and CSS has no `hsv()`, so
 * those would be saved as text no swatch can show. Anything else the picker ignores, so it must not reach the
 * form's value either.
 */
const PICKER_COLOR =
	/^(#([0-9a-f]{3}|[0-9a-f]{6})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*\d+(\.\d+)?\s*)?\)|hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*\d+(\.\d+)?\s*)?\))$/i;

/** Whether a value is a colour the picker accepts. */
function isPickerColor(value: unknown): value is string {
	return typeof value === 'string' && PICKER_COLOR.test(value.trim());
}

/**
 * Refuses a colour the picker cannot read; an empty value is left to `Validators.required`.
 *
 * A colour the tag was loaded with (the control still pristine) is left alone: older and seeded tags may hold a
 * colour name the picker does not know, and their other fields must stay editable. Once the viewer touches the
 * field, only a colour the picker reads is accepted.
 */
function pickerColorValidator(control: AbstractControl): ValidationErrors | null {
	const { value } = control;
	if (control.pristine || value === null || value === undefined || value === '') {
		return null;
	}
	return isPickerColor(value) ? null : { color: true };
}

@Component({
    selector: 'ngx-tags-mutation',
    templateUrl: './tags-mutation.component.html',
    styleUrls: ['./tags-mutation.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TagsMutationComponent extends NotesWithTagsComponent implements OnInit {
	/**
	 * Tag mutation form
	 */
	public form: UntypedFormGroup = TagsMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: [null, Validators.required],
			color: [null, [Validators.required, pickerColorValidator]],
			isTenantLevel: [false],
			description: [],
			tagTypeId: []
		});
	}

	/**
	 * List of tag types
	 */
	public tagTypes: ITagType[] = [];

	/**
	 * The colours offered in one click under the picker: twelve hues of even weight, each legible as the soft
	 * wash the Tags table draws a chip with, in the light and the dark theme alike.
	 */
	protected readonly presetColors: string[] = [
		'#E5484D',
		'#F76B15',
		'#FFB224',
		'#46A758',
		'#12A594',
		'#00A2C7',
		'#0090FF',
		'#3E63DD',
		'#8E4EC6',
		'#D6409F',
		'#AD7F58',
		'#8B8D98'
	];

	/** The last colour the field held that the picker accepts; a typed value it cannot read falls back to it. */
	private lastValidColor: string | null = null;

	/*
	 * Getter & Setter for tag to edit
	 */
	_tag: ITag;
	get tag(): ITag {
		return this._tag;
	}
	@Input() public set tag(tag: ITag) {
		this._tag = tag;
		this._patchFormValue();
	}

	/**
	 * Getter fr
	 * or color form control
	 */
	get color() {
		return this.form.get('color').value || '';
	}

	constructor(
		protected readonly dialogRef: NbDialogRef<TagsMutationComponent>,
		private readonly tagsService: TagsService,
		private readonly tagTypeService: TagTypesService,
		private readonly fb: UntypedFormBuilder,
		public readonly translateService: TranslateService,
		public readonly themeService: NbThemeService,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) {
		super(themeService, translateService);
	}

	ngOnInit(): void {
		this._loadTagTypes();
	}

	/**
	 * Fetch all tag types from the TagTypeService
	 */
	private async _loadTagTypes() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		try {
			const { items } = await this.tagTypeService.getTagTypes({
				tenantId,
				organizationId
			});

			this.tagTypes = items;
		} catch (error) {
			console.log(error);

			this.toastrService.danger('TAGS_PAGE.TAGS_FETCH_FAILED', 'Error fetching tag types');
		}
	}

	async addTag() {
		// Save is disabled while the form is invalid; this also covers a call that reaches here regardless.
		if (!this.store.selectedOrganization || this.form.invalid) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;
		const { name, description, color, isTenantLevel, tagTypeId } = this.form.getRawValue();

		const tag = await firstValueFrom(
			this.tagsService.create({
				name,
				description,
				color,
				tenantId,
				tagTypeId,
				...(isTenantLevel
					? {
							organizationId: null
					  }
					: {
							organizationId
					  })
			})
		);
		this.closeDialog(tag);
	}

	async editTag() {
		if (!this.store.selectedOrganization || this.form.invalid) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const { name, description, color, isTenantLevel, tagTypeId } = this.form.getRawValue();

		const tag = await firstValueFrom(
			this.tagsService.update(this.tag.id, {
				name,
				description,
				color,
				tenantId,
				tagTypeId,
				...(isTenantLevel
					? {
							organizationId: null
					  }
					: {
							organizationId
					  })
			})
		);
		this.closeDialog(tag);
	}

	async closeDialog(tag?: ITag) {
		this.dialogRef.close(tag);
	}

	private _patchFormValue() {
		if (this.tag) {
			const { name, color, description, organizationId, tagTypeId } = this.tag;
			this.lastValidColor = isPickerColor(color) ? color : null;
			this.form.patchValue({
				name,
				color,
				description,
				isTenantLevel: organizationId ? false : true,
				tagTypeId
			});
		}
	}

	/**
	 * On changed color input
	 *
	 * @param color
	 */
	onChangeColor(color: ITag['color']) {
		if (isPickerColor(color)) {
			this.lastValidColor = color;
		}
		this.form.get('color').setValue(color);
		this.form.get('color').updateValueAndValidity();
	}

	/**
	 * When the colour field loses focus holding text the picker cannot read, put back the last colour it accepted
	 * (or empty the field when there was none), so the value saved is always one the picker understands.
	 */
	protected restoreColorIfInvalid(): void {
		const control = this.form.get('color');
		// Only text the viewer typed: a colour the tag was loaded with stays as it is (see `pickerColorValidator`).
		if (control.dirty && control.value && !isPickerColor(control.value)) {
			control.setValue(this.lastValidColor);
			control.markAsTouched();
		}
	}

	/** Whether a preset is the colour the field holds now, for the preset button's pressed state. */
	protected isCurrentColor(preset: string): boolean {
		return typeof this.color === 'string' && this.color.toLowerCase() === preset.toLowerCase();
	}
}
