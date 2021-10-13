import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import {
	ContactType,
	IOrganizationContact,
	IProposalViewModel,
	ITag
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { ToastrService } from '../../../@core/services/toastr.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-proposal-edit',
	templateUrl: './proposal-edit.component.html',
	styleUrls: ['./proposal-edit.component.scss']
})
export class ProposalEditComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit {
	constructor(
		private route: ActivatedRoute,
		private store: Store,
		private fb: FormBuilder,
		private router: Router,
		private toastrService: ToastrService,
		private proposalsService: ProposalsService,
		private translate: TranslateService,
		private cdRef: ChangeDetectorRef,
		private organizationContactService: OrganizationContactService,
		private errorHandler: ErrorHandlingService
	) {
		super(translate);
	}

	proposalId: string;
	proposal: IProposalViewModel;
	tags: ITag[] = [];
	form: FormGroup;
	organizationContact: IOrganizationContact;
	organizationContacts: Object[] = [];
	public ckConfig: any = {
		width: '100%',
		height: '320',
    toolbar: [
      { name: 'document', items: [ 'Source', '-', 'Save', 'NewPage', 'ExportPdf', 'Preview', 'Print', '-', 'Templates' ] },
      { name: 'clipboard', items: [ 'Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo' ] },
      { name: 'editing', items: [ 'Find', 'Replace', '-', 'SelectAll', '-', 'Scayt' ] },
      { name: 'forms', items: [ 'Form', 'Checkbox', 'Radio', 'TextField', 'Textarea', 'Select', 'Button', 'ImageButton', 'HiddenField' ] },
      '/',
      { name: 'basicstyles', items: [ 'Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'CopyFormatting', 'RemoveFormat' ] }
    ],
    toolbarCanCollapse: true
	};

	ngOnInit() {
		this.route.params
			.pipe(
				untilDestroyed(this),
				tap((params) => (this.proposalId = params['id']))
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this),
				tap(() => this.getProposalById())
			)
			.subscribe();
	}

	async getProposalById() {
		if (!this.proposalId) {
			this.router.navigate([`/pages/sales/proposals`]);
		}
		const { tenantId } = this.store.user;
		const proposal = await this.proposalsService.getById(
			this.proposalId,
			{ tenantId },
			['employee', 'employee.user', 'tags', 'organizationContact']
		);
		this.proposal = Object.assign({}, proposal, {
			jobPostLink:
				'<a href="' +
				proposal.jobPostUrl +
				`" target="_blank">${proposal.jobPostUrl.substr(
					8,
					14
				)}</nb-icon></a>`,
			jobTitle: proposal.jobPostContent
				.toString()
				.replace(/<[^>]*(>|$)|&nbsp;/g, '')
				.split(/[\s,\n]+/)
				.slice(0, 3)
				.join(' '),
			author: proposal.employee.user
				? proposal.employee.user.firstName +
				  ' ' +
				  proposal.employee.user.lastName
				: ''
		});
		await this._getOrganizationContacts();
		this._initializeForm();
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	private _initializeForm() {
		this.tags = this.proposal.tags;
		this.form = this.fb.group({
			jobPostUrl: [
				this.proposal.jobPostUrl,
				Validators.compose([
					Validators.pattern(
						new RegExp(
							/^((?:https?:\/\/)[^./]+(?:\.[^./]+)+(?:\/.*)?)$/
						)
					)
				])
			],
			valueDate: [this.proposal.valueDate],
			jobPostContent: this.proposal.jobPostContent,
			proposalContent: this.proposal.proposalContent,
			organizationContact: this.proposal.organizationContact
		});
	}

	async editProposal() {
		if (this.form.valid) {
			const result = this.form.value;
			try {
				const { tenantId } = this.store.user;
				await this.proposalsService.update(this.proposal.id, {
					jobPostContent: result.jobPostContent,
					jobPostUrl: result.jobPostUrl,
					proposalContent: result.proposalContent,
					tags: this.tags,
					tenantId,
					organizationContactId: result.organizationContact
						? result.organizationContact.id
						: null
				});

				// TODO translate
				this.toastrService.success('NOTES.PROPOSALS.EDIT_PROPOSAL');

				this.router.navigate([`/pages/sales/proposals`]);
			} catch (error) {
				this.toastrService.danger(error);
			}
		}
	}

	private async _getOrganizationContacts() {
		const { items } = await this.organizationContactService.getAll([], {
			organizationId: this.proposal.organizationId,
			tenantId: this.proposal.organizationId
		});

		this.organizationContacts = items;
	}

	addNewOrganizationContact = (
		name: string
	): Promise<IOrganizationContact> => {
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT',
				{
					name: name
				}
			);
			return this.organizationContactService.create({
				name,
				contactType: ContactType.CLIENT,
				organizationId: this.proposal.organizationId,
				tenantId: this.proposal.organizationId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
