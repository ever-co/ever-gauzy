import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { TagsService } from '../../@core/services/tags.service';
import { ITag } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-tags-mutation',
	templateUrl: './tags-mutation.component.html',
	styleUrls: ['./tags-mutation.component.scss']
})
export class TagsMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	
	tag: ITag;
	
	private isTenantLevelChecked = false;
	public color = '';

	/**
	 * Build Form
	 * 
	 */
	public form: FormGroup = TagsMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: ['', Validators.required],
			color: [],
			isTenantLevel: [],
			description: []
		});
	}

	constructor(
		protected readonly dialogRef: NbDialogRef<TagsMutationComponent>,
		private readonly tagsService: TagsService,
		private readonly fb: FormBuilder,
		readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.initializeForm();
	}

	async addTag() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const { name, description } = this.form.getRawValue();

		if (this.isTenantLevelChecked) {
			const tagWithTenantLevel = await this.tagsService.insertTag(
				Object.assign({
					name,
					description,
					color: this.color,
					tenantId,
					organization: null,
				})
			);
			this.closeDialog(tagWithTenantLevel);
		} else {
			const tagWithoutTenantLevel = await this.tagsService.insertTag(
				Object.assign({
					name,
					description,
					color: this.color,
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

		const { name, description } = this.form.getRawValue();

		if (this.isTenantLevelChecked) {
			const tagWithTenantLevel = await this.tagsService.update(
				this.tag.id,
				Object.assign({
					name,
					description,
					color: this.color,
					organizationId: null,
					tenantId
				})
			);
			this.closeDialog(tagWithTenantLevel);
		} else {
			const tagWithoutTenantLevel = await this.tagsService.update(
				this.tag.id,
				Object.assign({
					name,
					description,
					color: this.color,
					organizationId,
					tenantId
				})
			);
			this.closeDialog(tagWithoutTenantLevel);
		}
	}

	async closeDialog(tag?: ITag) {
		this.dialogRef.close(tag);
	}

	initializeForm() {
		if (this.tag) {
			this.color = this.tag.color;
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
}
