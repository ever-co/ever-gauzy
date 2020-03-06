import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { FormBuilder, Validators } from '@angular/forms';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';
import { OrganizationClients } from '@gauzy/models';

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
		private readonly organizationClientService: OrganizationClientsService
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
		this.form = this.fb.group({
			name: ['', Validators.required],
			primaryEmail: ['', [Validators.required, Validators.email]],
			primaryPhone: ['', Validators.required]
		});
	}

	closeDialog(organizationClient) {
		this.dialogRef.close(organizationClient);
		console.log(organizationClient);
	}

	async add() {
		try {
			if (this.form.valid) {
				const organizationClient = this.organizationClient
					? this.organizationClient
					: await this.organizationClientService.create({
							organizationId: this.organizationId,
							...this.form.getRawValue()
					  });
				const invited = await this.organizationClientService.invite(
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
}
