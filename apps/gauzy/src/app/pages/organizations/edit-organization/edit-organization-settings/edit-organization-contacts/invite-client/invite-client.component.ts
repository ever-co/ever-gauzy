import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormBuilder, Validators } from '@angular/forms';
import { OrganizationContactsService } from 'apps/gauzy/src/app/@core/services/organization-contacts.service ';
import { OrganizationContacts } from '@gauzy/models';
import { UsersService } from 'apps/gauzy/src/app/@core/services';
import { InviteService } from 'apps/gauzy/src/app/@core/services/invite.service';

@Component({
	selector: 'ga-invite-client',
	templateUrl: './invite-client.component.html'
})
export class InviteClientComponent extends TranslationBaseComponent
	implements OnInit {
	constructor(
		private readonly dialogRef: NbDialogRef<InviteClientComponent>,
		readonly translateService: TranslateService,
		private readonly toastrService: NbToastrService,
		private readonly fb: FormBuilder,
		private readonly organizationContactService: OrganizationContactsService,
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
	organizationContact?: OrganizationContacts = undefined;

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

	async inviteClient() {
		const organizationContact: OrganizationContacts = await this.addOrEditClient();
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

	async addOrEditClient(): Promise<OrganizationContacts> {
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
