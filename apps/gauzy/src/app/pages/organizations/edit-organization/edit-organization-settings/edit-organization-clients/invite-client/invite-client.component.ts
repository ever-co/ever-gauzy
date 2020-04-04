import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormBuilder, Validators } from '@angular/forms';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';
import { OrganizationClients } from '@gauzy/models';
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
		private readonly organizationClientService: OrganizationClientsService,
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
	organizationClient?: OrganizationClients = undefined;

	ngOnInit(): void {
		this.form = this.fb.group(
			{
				name: [
					this.organizationClient ? this.organizationClient.name : '',
					Validators.required
				],
				primaryEmail: [
					this.organizationClient
						? this.organizationClient.primaryEmail
						: '',
					[Validators.required, Validators.email]
				],
				primaryPhone: [
					this.organizationClient
						? this.organizationClient.primaryPhone
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

	closeDialog(organizationClient?) {
		this.dialogRef.close(organizationClient);
	}

	async inviteClient() {
		const organizationClient: OrganizationClients = await this.addOrEditClient();
		try {
			if (organizationClient) {
				const invited = this.inviteService.inviteOrganizationClient(
					organizationClient.id
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

	async addOrEditClient(): Promise<OrganizationClients> {
		try {
			if (this.organizationClient) {
				return await this.organizationClientService.create({
					...this.organizationClient,
					...this.form.getRawValue()
				});
			} else if (this.form.valid) {
				return await this.organizationClientService.create({
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
