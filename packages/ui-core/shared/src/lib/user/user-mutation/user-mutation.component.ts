import { Component, OnInit, ViewChild } from '@angular/core';
import { RolesEnum, IUser, IOrganization } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { BasicInfoFormComponent } from '../forms/basic-info/basic-info-form.component';
import { filter, tap } from 'rxjs/operators';

@Component({
    selector: 'ga-user-mutation',
    templateUrl: './user-mutation.component.html',
    styleUrls: ['./user-mutation.component.scss'],
    standalone: false
})
export class UserMutationComponent implements OnInit {
	@ViewChild('userBasicInfo') userBasicInfo: BasicInfoFormComponent;

	public organization: IOrganization;

	constructor(
		private readonly _dialogRef: NbDialogRef<UserMutationComponent>,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService
	) {}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization))
			)
			.subscribe();
	}

	/**
	 * Closes the dialog and passes the user data if provided.
	 *
	 * @param user - The user object to pass when closing the dialog. Defaults to null.
	 */
	closeDialog(user: IUser = null): void {
		this._dialogRef.close({ user });
	}

	/**
	 * Registers a user with the default role of VIEWER and associates them with the current organization.
	 * Closes the dialog with the newly registered user or shows an error if the registration fails.
	 */
	async add(): Promise<void> {
		if (!this.organization) {
			return;
		}

		try {
			const user = await this.userBasicInfo.registerUser(
				RolesEnum.VIEWER,
				this.organization.id,
				this._store.userId
			);
			this.closeDialog(user);
		} catch (error) {
			this._toastrService.danger(error);
		}
	}
}
