import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../../../../@shared/language-base/translation-base.component';
import { FormBuilder, Validators } from '@angular/forms';
import { OrganizationContactService } from '../../../../../../@core/services/organization-contact.service';
import { OrganizationContact } from '@gauzy/models';
import { UsersService } from '../../../../../../@core/services';
import { InviteService } from '../../../../../../@core/services/invite.service';

@Component({
	selector: 'ga-invite-contact',
	templateUrl: './invite-contact.component.html'
})
export class InviteContactComponent extends TranslationBaseComponent
	implements OnInit {
	constructor(
		private readonly dialogRef: NbDialogRef<InviteContactComponent>,
		readonly translateService: TranslateService,
		private readonly toastrService: NbToastrService,
		private readonly fb: FormBuilder,
		private readonly organizationContactService: OrganizationContactService,
		private readonly usersService: UsersService,
		private readonly inviteService: InviteService
	) {
		super(translateService);
	}

	form: any;
	emails: any;

	@Input()
	organizationId = '';

	@Input()
	organizationContact?: OrganizationContact = undefined;

	ngOnInit(): void {
		this.form = this.fb.group(
			{
				name: [
					this.organizationContact
						? this.organizationContact.name
						: '',
					Validators.required
				],
				primaryEmail: [
					this.organizationContact
						? this.organizationContact.primaryEmail
						: '',
					[Validators.required, Validators.email]
				],
				primaryPhone: [
					this.organizationContact
						? this.organizationContact.primaryPhone
						: '',
					Validators.required
				]
			},
			{
				asyncValidators: async (form) => {
					const user = await this.usersService.getUserByEmail(
						form.get('primaryEmail').value
					);
					if (user) {
						form.get('primaryEmail').setErrors({ invalid: true });
						form.get('primaryEmail').setErrors({ exists: true });
					}
				}
			}
		);
	}

	closeDialog(organizationContact?) {
		this.dialogRef.close(organizationContact);
	}

	async inviteContact() {
		const organizationContact: OrganizationContact = await this.addOrEditOrganizationContact();
		try {
			if (organizationContact) {
				const invited = this.inviteService.inviteOrganizationContact(
					organizationContact.id
				);
				this.closeDialog(invited);
			}
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				'Error'
			);
		}
	}

	async addOrEditOrganizationContact(): Promise<OrganizationContact> {
		try {
			if (this.organizationContact) {
				return await this.organizationContactService.create({
					...this.organizationContact,
					...this.form.getRawValue()
				});
			} else if (this.form.valid) {
				return await this.organizationContactService.create({
					organizationId: this.organizationId,
					...this.form.getRawValue()
				});
			}
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				'Error'
			);
		}
		return null;
	}
}
