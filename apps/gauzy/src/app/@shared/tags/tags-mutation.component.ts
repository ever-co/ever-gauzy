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
	selectedUser: { userName: string }[] = [];
	selectedColor: { color: string }[] = [];
	form: FormGroup;
	tag: Tag;
    

	constructor(
		protected dialogRef: NbDialogRef<TagsMutationComponent>,
		private tagsService: TagsService,
		private fb: FormBuilder
	) {}


	// get name() {
	// 	return this.form.get('name').value;
	// }

	// set name(value) {
	// 	this.form.setValue(value);
	// }

	// get description() {
	// 	return this.form.get('description').value;
	// }
	// set description(value) {
	// 	this.form.setValue(value)
	// }
     
	ngOnInit() {
		this.seedFakeData();
		this.initializeForm();
		console.warn(this.form);
	}

async addTag(){
	this.dialogRef.close()
	this.tagsService.insertTag(Object.assign({
		name: this.form.value.name,
		description: this.form.value.description,
		color: this.form.value.color,
	}))

}





	async closeDialog() {
		this.dialogRef.close();
	}
	
	async initializeForm() {
		this.form = this.fb.group({
			name:["pesho"],
			description:["TEST TEST TEST"],
			color:["red"]
		});
		
	}
	

	async seedFakeData() {
		if (!this.selectedUser.length) {
			const fakeUsers = ['Employee', 'User', 'Organization'];

			fakeUsers.forEach((name) => {
				this.selectedUser.push({
					userName: name
				});
			});
		}
		if (!this.selectedColor.length) {
			const selectedColor = ['Critical', 'Important', 'Archived'];

			selectedColor.forEach((color) =>
				this.selectedColor.push({
					color: color
				})
			);
		}
	}
}
