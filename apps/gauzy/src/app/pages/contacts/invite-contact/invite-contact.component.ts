import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntypedFormBuilder, Validators } from '@angular/forms';
import { IOrganization, IOrganizationContact } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { InviteService, OrganizationContactService, ToastrService, UsersService } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-invite-contact',
	templateUrl: './invite-contact.component.html',
	styleUrls: ['./invite-contact.component.scss']
})
export class InviteContactComponent extends TranslationBaseComponent implements OnInit {
	constructor(
		private readonly dialogRef: NbDialogRef<InviteContactComponent>,
		readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly fb: UntypedFormBuilder,
		private readonly organizationContactService: OrganizationContactService,
		private readonly usersService: UsersService,
		private readonly inviteService: InviteService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	form: any;
	emails: any;

	@Input()
	organizationId = '';

	@Input()
	contactType: string;

	@Input()
	organizationContact?: IOrganizationContact = undefined;

	@Input()
	selectedOrganization: IOrganization;

	ngOnInit(): void {
		this.form = this.fb.group(
			{
				name: [this.organizationContact ? this.organizationContact.name : '', Validators.required],
				primaryEmail: [
					this.organizationContact ? this.organizationContact.primaryEmail : '',
					[Validators.required, Validators.email]
				],
				primaryPhone: [
					this.organizationContact ? this.organizationContact.primaryPhone : '',
					Validators.required
				]
			},
			{
				asyncValidators: async (form) => {
					const user = await this.usersService.getUserByEmail(form.get('primaryEmail').value);
					if (!!user) {
						form.get('primaryEmail').setErrors({ invalid: true });
						form.get('primaryEmail').setErrors({ exists: true });
					}
				}
			}
		);
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	closeDialog(organizationContact?) {
		this.dialogRef.close(organizationContact);
	}

	async inviteContact() {
		const organizationContact: IOrganizationContact = await this.addOrEditOrganizationContact();
		try {
			if (organizationContact) {
				const invited = this.inviteService.inviteOrganizationContact(organizationContact.id);
				this.closeDialog(invited);
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async addOrEditOrganizationContact(): Promise<IOrganizationContact> {
		try {
			if (this.organizationContact) {
				return await this.organizationContactService.create({
					...this.organizationContact,
					tenantId: this.selectedOrganization.tenantId,
					contactType: this.contactType,
					...this.form.getRawValue()
				});
			} else if (this.form.valid) {
				return await this.organizationContactService.create({
					organizationId: this.organizationId,
					tenantId: this.selectedOrganization.tenantId,
					contactType: this.contactType,
					...this.form.getRawValue()
				});
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
		return null;
	}
}
