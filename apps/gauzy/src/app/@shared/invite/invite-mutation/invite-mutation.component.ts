import { Component, Input, OnInit, ViewChild } from '@angular/core';
import {
	InvitationTypeEnum,
	Invite,
	OrganizationProjects,
	OrganizationClients,
	OrganizationDepartment
} from '@gauzy/models';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { EmailInviteFormComponent } from '../forms/email-invite-form/email-invite-form.component';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { OrganizationDepartmentsService } from '../../../@core/services/organization-departments.service';

@Component({
	selector: 'ga-invite-mutation',
	templateUrl: './invite-mutation.component.html',
	styleUrls: ['./invite-mutation.component.scss']
})
export class InviteMutationComponent implements OnInit {
	@Input()
	invitationType: InvitationTypeEnum;

	@Input()
	selectedOrganizationId: string;

	@Input()
	currentUserId: string;

	@ViewChild('emailInviteForm', { static: false })
	emailInviteForm: EmailInviteFormComponent;

	organizationProjects: OrganizationProjects[];
	organizationClients: OrganizationClients[];
	organizationDepartments: OrganizationDepartment[];

	constructor(
		private dialogRef: NbDialogRef<InviteMutationComponent>,
		private organizationProjectsService: OrganizationProjectsService,
		private organizationClientsService: OrganizationClientsService,
		private organizationDepartmentsService: OrganizationDepartmentsService,
		private translateService: TranslateService,
		private toastrService: NbToastrService
	) {}

	ngOnInit(): void {
		this.loadOrganizationData();
	}

	loadOrganizationData() {
		if (!this.selectedOrganizationId) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.MESSAGE.PROJECT_LOAD'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		try {
			this.loadProjects();
			this.loadClients();
			this.loadDepartments();
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	async loadProjects() {
		const res = await this.organizationProjectsService.getAll([], {
			organizationId: this.selectedOrganizationId
		});
		this.organizationProjects = res.items;
	}

	async loadClients() {
		const res = await this.organizationClientsService.getAll([], {
			organizationId: this.selectedOrganizationId
		});
		this.organizationClients = res.items;
	}

	async loadDepartments() {
		const res = await this.organizationDepartmentsService.getAll({
			organizationId: this.selectedOrganizationId
		});
		this.organizationDepartments = res.items;
	}

	closeDialog(savedInvites: Invite[] = []) {
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

	getTranslation(prefix: string, params?: Object) {
		let result = '';
		this.translateService.get(prefix, params).subscribe((res) => {
			result = res;
		});

		return result;
	}
}
