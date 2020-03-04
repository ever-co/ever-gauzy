import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormGroup, FormBuilder } from '@angular/forms';
import { TagsService } from '../../@core/services/tags.service';
import { Tag } from '@gauzy/models';
@Component({
	selector: 'ngx-tags-mutation',
	templateUrl: './tags-mutation.component.html',
	styleUrls: ['./tags-mutation.component.scss']
})
export class TagsMutationComponent implements OnInit {
	selectedColor: string[] = [];
	form: FormGroup;
	tag: Tag;
	
	public color1: string = '#2889e9';
	constructor(
		protected dialogRef: NbDialogRef<TagsMutationComponent>,
		private tagsService: TagsService,
		private fb: FormBuilder
	) {}


	ngOnInit() {
		this.seedFakeData();
		this.initializeForm();
	}

	async addTag() {
		this.dialogRef.close();
		this.tagsService.insertTag(
			Object.assign({
				name: this.form.value.name,
				description: this.form.value.description,
				color: this.form.value.color
			})
		);
	}
	async editTag() {
		await this.tagsService.update(
			this.tag.id,
			Object.assign({
				name: this.form.value.name,
				description: this.form.value.description,
				color: this.form.value.color
			})
		);
		this.closeDialog();
	}

	async closeDialog() {
		this.dialogRef.close();
	}

	async initializeForm() {
		if (this.tag) {
			this.form = this.fb.group({
				name: [this.tag.name],
				color: [this.tag.color],
				description: [this.tag.description]
			});
		} else {
			this.form = this.fb.group({
				name: [''],
				description: [''],
				color: ['ASDDAS']
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
