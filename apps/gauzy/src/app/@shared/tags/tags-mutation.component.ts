import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
@Component({
	selector: 'ngx-tags-mutation',
	templateUrl: './tags-mutation.component.html',
	styleUrls: ['./tags-mutation.component.scss']
})
export class TagsMutationComponent implements OnInit {
	selectedUser: { userName: string }[] = [];
	selectedColor: { color: string }[] = [];
	constructor(protected dialogRef: NbDialogRef<TagsMutationComponent>) {}
	ngOnInit() {
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
	async closeDialog() {
		this.dialogRef.close();
	}
}
