import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { RolesEnum, User, Tag } from '@gauzy/models';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { BasicInfoFormComponent } from '../forms/basic-info/basic-info-form.component';

@Component({
	selector: 'ga-user-mutation',
	templateUrl: './user-mutation.component.html',
	styleUrls: ['./user-mutation.component.scss']
})
export class UserMutationComponent implements OnInit {
	@ViewChild('userBasicInfo', { static: false })
	userBasicInfo: BasicInfoFormComponent;
	tags: Tag[];
	selectedTags: any;

	@Input() public isSuperAdmin: boolean;

	constructor(
		protected dialogRef: NbDialogRef<UserMutationComponent>,
		protected store: Store,
		private toastrService: NbToastrService
	) {}

	ngOnInit(): void {}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	closeDialog(user: User = null) {
		this.dialogRef.close({ user });
	}

	async add() {
		try {
			const organization = await this.store.selectedOrganization;
			const user = await this.userBasicInfo.registerUser(
				RolesEnum.VIEWER,
				organization.id,
				this.store.userId
			);
			this.closeDialog(user);
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				'Error'
			);
		}
	}
}
