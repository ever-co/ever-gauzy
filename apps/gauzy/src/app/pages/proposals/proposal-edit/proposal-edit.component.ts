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
import { IProposal, ITag } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import {
	ProposalsService,
	Store,
	ToastrService
} from '../../../@core/services';
import { ckEditorConfig } from "../../../@shared/ckeditor.config";
import { UrlPatternValidator } from '../../../@core/validators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-proposal-edit',
	templateUrl: './proposal-edit.component.html',
	styleUrls: ['./proposal-edit.component.scss']
})
export class ProposalEditComponent extends TranslationBaseComponent
	implements OnInit, AfterViewInit {

	proposal: IProposal;
	ckConfig: CKEditor4.Config = ckEditorConfig;

	/*
	* Proposal Mutation Form
	*/
	public form: FormGroup = ProposalEditComponent.buildForm(this.fb, this);
	static buildForm(fb: FormBuilder, self: ProposalEditComponent): FormGroup {
		return fb.group({
			jobPostUrl: [],
			valueDate: [
				self.store.getDateFromOrganizationSettings(),
				Validators.required
			],
			jobPostContent: [null, Validators.required],
			proposalContent: [null, Validators.required],
			tags: [],
			organizationContact: [],
			employee: []
		}, {
			validators: [
				UrlPatternValidator.websiteUrlValidator('jobPostUrl'),
			]
		});
	}

	constructor(
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly fb: FormBuilder,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly proposalsService: ProposalsService,
		public readonly translate: TranslateService,
		private readonly cdRef: ChangeDetectorRef
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.route.data
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((data) => !!data && !!data.proposal),
				tap(({ proposal }) => {
					try {
						this.proposal = Object.assign({}, proposal, {
							jobPostLink: proposal.jobPostUrl ? proposal.jobPostUrl : '',
							jobTitle: proposal.jobPostContent
								.toString()
								.replace(/<[^>]*(>|$)|&nbsp;/g, '')
								.split(/[\s,\n]+/)
								.slice(0, 3)
								.join(' '),
							author: proposal.employee
						});
					} catch (error) {
						this.router.navigate(['/pages/sales/proposals']);
					}
				}),
				tap(() => this._patchFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	private _patchFormValue() {
		if (this.proposal) {
			this.form.patchValue({
				jobPostUrl: this.proposal.jobPostUrl,
				valueDate: this.proposal.valueDate,
				jobPostContent: this.proposal.jobPostContent,
				proposalContent: this.proposal.proposalContent,
				organizationContact: this.proposal.organizationContact,
				tags: this.proposal.tags,
				employee: this.proposal.employee
			});
		}
	}

	async editProposal() {
		if (this.form.valid && this.proposal) {
			try {
				const { tenantId } = this.store.user;
				const { organizationId } = this.proposal;

				const { jobPostContent, jobPostUrl, proposalContent, tags } = this.form.getRawValue();
				const {  organizationContact } = this.form.getRawValue();

				try {
					await this.proposalsService.update(this.proposal.id, {
						tenantId,
						organizationId,
						jobPostContent: jobPostContent,
						jobPostUrl: jobPostUrl,
						proposalContent: proposalContent,
						tags: tags,
						organizationContactId: organizationContact ? organizationContact.id : null
					});
					this.toastrService.success('NOTES.PROPOSALS.EDIT_PROPOSAL');
				} finally {
					this.router.navigate([`/pages/sales/proposals`]);
				}
			} catch (error) {
				this.toastrService.danger(error);
			}
		}
	}

	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}
}
