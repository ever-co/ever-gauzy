import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder } from '@angular/forms';
import { TagsService } from '../../@core/services/tags.service';
import { Tag } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';

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

	public color: string = '';
	public name: string = '';
	constructor(
		protected dialogRef: NbDialogRef<TagsMutationComponent>,
		private tagsService: TagsService,
		private fb: FormBuilder,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.seedFakeData();
		this.initializeForm();
	}

	async addTag() {
		const tag = await this.tagsService.insertTag(
			Object.assign({
				name: this.form.value.name,
				description: this.form.value.description,
				color: this.color
			})
		);
		this.closeDialog(tag);
	}
	async editTag() {
		const tag = await this.tagsService.update(
			this.tag.id,
			Object.assign({
				name: this.form.value.name,
				description: this.form.value.description,
				color: this.color
			})
		);
		this.closeDialog(tag);
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
				description: [this.tag.description]
			});
		} else {
			this.form = this.fb.group({
				name: [''],
				description: [''],
				color: ['']
			});
		}
	}

	async seedFakeData() {
		if (!this.selectedColor.length) {
			const selectedColor = ['Critical', 'Important', 'Archived'];

			selectedColor.forEach((color) => this.selectedColor.push(color));
		}
	}
}
