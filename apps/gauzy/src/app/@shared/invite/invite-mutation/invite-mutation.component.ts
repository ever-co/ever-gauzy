import { Component, Input, OnInit, ViewChild } from '@angular/core';
import {
	InvitationTypeEnum,
	IInvite,
	IOrganizationProject,
	IOrganizationContact,
	IOrganizationDepartment,
	IOrganization
} from '@gauzy/models';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { EmailInviteFormComponent } from '../forms/email-invite-form/email-invite-form.component';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { OrganizationDepartmentsService } from '../../../@core/services/organization-departments.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-invite-mutation',
	templateUrl: './invite-mutation.component.html',
	styleUrls: ['./invite-mutation.component.scss']
})
export class InviteMutationComponent extends TranslationBaseComponent
	implements OnInit {
	@Input()
	invitationType: InvitationTypeEnum;

	@Input()
	selectedOrganizationId: string;

	@Input()
	selectedOrganization: IOrganization;

	@Input()
	currentUserId: string;

	@Input()
	isSuperAdmin: boolean;

	@ViewChild('emailInviteForm')
	emailInviteForm: EmailInviteFormComponent;

	organizationProjects: IOrganizationProject[];
	organizationContact: IOrganizationContact[];
	organizationDepartments: IOrganizationDepartment[];

	constructor(
		private dialogRef: NbDialogRef<InviteMutationComponent>,
		private organizationProjectsService: OrganizationProjectsService,
		private organizationContactService: OrganizationContactService,
		private organizationDepartmentsService: OrganizationDepartmentsService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadOrganizationData();
	}

	async loadOrganizationData() {
		if (!this.selectedOrganizationId) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.MESSAGE.PROJECT_LOAD'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		try {
			await this.loadProjects();
			await this.loadOrganizationContacts();
			await this.loadDepartments();
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	async loadProjects() {
		const { items = [] } = await this.organizationProjectsService.getAll(
			[],
			{
				organizationId: this.selectedOrganizationId,
				tenantId: this.selectedOrganization.tenantId
			}
		);
		this.organizationProjects = items;
	}

	async loadOrganizationContacts() {
		const { items = [] } = await this.organizationContactService.getAll(
			[],
			{
				organizationId: this.selectedOrganizationId,
				tenantId: this.selectedOrganization.tenantId
			}
		);
		this.organizationContact = items;
	}

	async loadDepartments() {
		const { items = [] } = await this.organizationDepartmentsService.getAll(
			[],
			{
				organizationId: this.selectedOrganizationId,
				tenantId: this.selectedOrganization.tenantId
			}
		);
		this.organizationDepartments = items;
	}

	closeDialog(savedInvites: IInvite[] = []) {
		this.dialogRef.close(savedInvites);
	}

	async add() {
		try {
			const {
				items,
				total,
				ignored
			} = await this.emailInviteForm.saveInvites();

			if (ignored > 0) {
				this.toastrService.warning(
					this.getTranslation('INVITE_PAGE.IGNORED', {
						total,
						ignored
					}),
					this.getTranslation('TOASTR.TITLE.WARNING')
				);
			} else {
				this.toastrService.success(
					this.getTranslation('INVITE_PAGE.SENT', { total }),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}

			this.closeDialog(items);
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				'Error'
			);
		}
	}
}
