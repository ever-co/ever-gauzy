import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	IOrganization,
	IOrganizationContact,
	IProposalViewModel,
	ITag
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import {
	ProposalsService,
	Store,
	ToastrService
} from '../../../@core/services';
import { ckEditorConfig } from "../../../@shared/ckeditor.config";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-proposal-edit',
	templateUrl: './proposal-edit.component.html',
	styleUrls: ['./proposal-edit.component.scss']
})
export class ProposalEditComponent extends TranslationBaseComponent 
	implements OnInit, AfterViewInit {

	proposalId: string;
	proposal: IProposalViewModel;
	tags: ITag[] = [];
	form: FormGroup;
	ckConfig: CKEditor4.Config = ckEditorConfig;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly fb: FormBuilder,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly proposalsService: ProposalsService,
		private readonly translate: TranslateService,
		private readonly cdRef: ChangeDetectorRef
	) {
		super(translate);
	}

	ngOnInit() {
		this.route.params
			.pipe(
				untilDestroyed(this),
				tap((params) => (this.proposalId = params['id']))
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap(() => this.getProposalById()),
				untilDestroyed(this)
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
			jobPostLink: proposal.jobPostUrl ? proposal.jobPostUrl : '',
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
						: null,
					status: this.proposal.status,
					valueDate: this.proposal.valueDate
				});

				// TODO translate
				this.toastrService.success('NOTES.PROPOSALS.EDIT_PROPOSAL');

				this.router.navigate([`/pages/sales/proposals`]);
			} catch (error) {
				this.toastrService.danger(error);
			}
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
