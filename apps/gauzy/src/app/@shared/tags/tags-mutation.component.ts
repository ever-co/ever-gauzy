import { Component, OnInit } from '@angular/core';
import { NbDialogRef, NbThemeService } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ITag, ITagCreateInput, ITagUpdateInput } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Store, TagsService } from '../../@core/services';
import { NotesWithTagsComponent } from '../table-components';

@Component({
	selector: 'ngx-tags-mutation',
	templateUrl: './tags-mutation.component.html',
	styleUrls: ['./tags-mutation.component.scss']
})
export class TagsMutationComponent extends NotesWithTagsComponent implements OnInit {

	public tag: ITag;
	private isTenantLevelChecked = false;

	/**
	 * Tag mutation form
	 */
	public form: FormGroup = TagsMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: [null, Validators.required],
			color: [null, Validators.required],
			isTenantLevel: [],
			description: []
		});
	}

	/**
	 * Getter for color form control
	 */
	get color() {
		return this.form.get('color').value || '';
	}

	constructor(
		protected readonly dialogRef: NbDialogRef<TagsMutationComponent>,
		private readonly tagsService: TagsService,
		private readonly fb: FormBuilder,
		public readonly translateService: TranslateService,
		public readonly themeService: NbThemeService,
		private readonly store: Store
	) {
		super(themeService, translateService);
	}

	ngOnInit() {
		this.initializeForm();
	}

	async addTag() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const { name, description, color } = this.form.getRawValue();

		if (this.isTenantLevelChecked) {
			const tagWithTenantLevel = await this.tagsService.create(
				Object.assign({
					name,
					description,
					color,
					tenantId,
					organizationId: null
				})
			);
			this.closeDialog(tagWithTenantLevel);
		} else {
			const tagWithoutTenantLevel = await this.tagsService.create(
				Object.assign({
					name,
					description,
					color,
					tenantId,
					organizationId
				})
			);
			this.closeDialog(tagWithoutTenantLevel);
		}
	}

	async editTag() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const { name, description, color } = this.form.getRawValue();

		if (this.isTenantLevelChecked) {
			const tagWithTenantLevel = await this.tagsService.update(
				this.tag.id,
				{
					name,
					description,
					color,
					organizationId: null,
					tenantId
				}
			);
			this.closeDialog(tagWithTenantLevel);
		} else {
			const tagWithoutTenantLevel = await this.tagsService.update(
				this.tag.id,
				{
					name,
					description,
					color,
					organizationId,
					tenantId
				}
			);
			this.closeDialog(tagWithoutTenantLevel);
		}
	}

	async closeDialog(tag?: ITagCreateInput | ITagUpdateInput) {
		this.dialogRef.close(tag);
	}

	initializeForm() {
		if (this.tag) {
			this.form.patchValue({
				name: this.tag.name,
				color: this.tag.color,
				description: this.tag.description,
				isTenantLevel: this.tag.organizationId ? false : true
			});
		}
	}

	isChecked(checked: boolean) {
		this.isTenantLevelChecked = checked;
	}

	/**
	 * On changed color input
	 *
	 * @param color
	 */
	onChangeColor(color: ITag['color']) {
		this.form.get('color').setValue(color);
		this.form.get('color').updateValueAndValidity();
	}
}
