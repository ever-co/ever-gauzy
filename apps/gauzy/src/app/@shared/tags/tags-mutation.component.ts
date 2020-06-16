import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder } from '@angular/forms';
import { TagsService } from '../../@core/services/tags.service';
import { Tag } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-tags-mutation',
	templateUrl: './tags-mutation.component.html',
	styleUrls: ['./tags-mutation.component.scss']
})
export class TagsMutationComponent extends TranslationBaseComponent
	implements OnInit {
	selectedColor: string[] = [];
	form: FormGroup;
	tag: Tag;
	private isTenantLevelChecked = false;

	public color = '';
	public name = '';
	constructor(
		protected dialogRef: NbDialogRef<TagsMutationComponent>,
		private tagsService: TagsService,
		private fb: FormBuilder,
		readonly translateService: TranslateService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.initializeForm();
	}

	async addTag() {
		if (this.isTenantLevelChecked) {
			const tagWithTenantLevel = await this.tagsService.insertTag(
				Object.assign({
					name: this.form.value.name,
					description: this.form.value.description,
					color: this.color,
					organization: null,
					tenant: this.store.selectedOrganization.tenantId
				})
			);
			this.closeDialog(tagWithTenantLevel);
		} else {
			const tagWithoutTenantLevel = await this.tagsService.insertTag(
				Object.assign({
					name: this.form.value.name,
					description: this.form.value.description,
					color: this.color,
					organization: this.store.selectedOrganization,
					tenant: null
				})
			);
			this.closeDialog(tagWithoutTenantLevel);
		}
	}
	async editTag() {
		if (this.isTenantLevelChecked) {
			const tagWithTenantLevel = await this.tagsService.update(
				this.tag.id,
				Object.assign({
					name: this.form.value.name,
					description: this.form.value.description,
					color: this.color,
					organization: null,
					tenant: this.store.selectedOrganization.tenantId
				})
			);
			this.closeDialog(tagWithTenantLevel);
		} else {
			const tagWithoutTenantLevel = await this.tagsService.update(
				this.tag.id,
				Object.assign({
					name: this.form.value.name,
					description: this.form.value.description,
					color: this.color,
					organization: this.store.selectedOrganization,
					tenant: null
				})
			);
			this.closeDialog(tagWithoutTenantLevel);
		}
	}

	async closeDialog(tag?: Tag) {
		this.dialogRef.close(tag);
	}

	async initializeForm() {
		if (this.tag) {
			this.color = this.tag.color;
			this.name = this.tag.name;
			this.form = this.fb.group({
				name: [this.tag.name],
				color: [this.tag.color],
				description: [this.tag.description],
				isTenantLevel: [this.tag.tenant ? true : false]
			});
		} else {
			this.form = this.fb.group({
				isTenantLevel: [],
				name: [''],
				description: [''],
				color: ['']
			});
		}
	}
	isChecked(checked: boolean) {
		this.isTenantLevelChecked = checked;
	}
}
