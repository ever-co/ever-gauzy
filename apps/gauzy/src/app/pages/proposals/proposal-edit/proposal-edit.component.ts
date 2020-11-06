import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { IProposalViewModel, ITag } from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-proposal-edit',
	templateUrl: './proposal-edit.component.html'
})
export class ProposalEditComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit {
	constructor(
		private route: ActivatedRoute,
		private store: Store,
		private fb: FormBuilder,
		private router: Router,
		private toastrService: NbToastrService,
		private proposalsService: ProposalsService,
		private translate: TranslateService,
		private cdRef: ChangeDetectorRef
	) {
		super(translate);
	}

	proposalId: string;
	proposal: IProposalViewModel;
	tags: ITag[] = [];
	form: FormGroup;
	public ckConfig: any = {
		width: '100%',
		height: '320'
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
			['employee', 'employee.user', 'tags']
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
		this._initializeForm();
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	private _initializeForm() {
		this.tags = this.proposal.tags;
		this.form = this.fb.group({
			jobPostUrl: [this.proposal.jobPostUrl],
			valueDate: [this.proposal.valueDate],
			jobPostContent: this.proposal.jobPostContent,
			proposalContent: this.proposal.proposalContent
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
					tenantId
				});

				// TODO translate
				this.toastrService.primary(
					this.getTranslation('NOTES.PROPOSALS.EDIT_PROPOSAL'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);

				this.router.navigate([`/pages/sales/proposals`]);
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation(
						'NOTES.PROPOSALS.REGISTER_PROPOSAL_ERROR',
						{
							error: error.error.message || error.message
						}
					),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			}
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
