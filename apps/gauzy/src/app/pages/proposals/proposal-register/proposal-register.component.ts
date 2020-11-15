import {
	Component,
	OnInit,
	ViewChild,
	OnDestroy,
	AfterViewInit,
	ChangeDetectorRef
} from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import {
	ProposalStatusEnum,
	ITag,
	IOrganization,
	IEmployee,
	IEmployeeProposalTemplate
} from '@gauzy/models';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposal-register',
	templateUrl: './proposal-register.component.html',
	styleUrls: ['././proposal-register.component.scss']
})
export class ProposalRegisterComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	proposalTemplate: IEmployeeProposalTemplate;
	proposalTemplateId: string;
	form: FormGroup;
	selectedOrganization: IOrganization;
	tags: ITag[] = [];
	public ckConfig: any = {
		width: '100%',
		height: '320'
	};
	minDate = new Date(moment().subtract(1, 'days').format('YYYY-MM-DD'));
	selectedEmployee: IEmployee;

	constructor(
		private fb: FormBuilder,
		private store: Store,
		private router: Router,
		private proposalsService: ProposalsService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private cdRef: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				if (org) {
					this.selectedOrganization = org;
				}
			});
	}

	ngOnDestroy(): void {}

	onEmployeeChange(item: IEmployee): void {
		this.selectedEmployee = item;
		this.proposalTemplateId = null;
	}

	onProposalTemplateChange(item: IEmployeeProposalTemplate): void {
		console.log(item);
		this.form.get('proposalContent').setValue(item.content);
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			jobPostUrl: ['', Validators.required],
			valueDate: [new Date(), Validators.required],
			jobPostContent: [''],
			proposalContent: [''],
			tags: ['']
		});
	}

	public async registerProposal() {
		if (this.form.valid) {
			const result = this.form.value;
			const selectedEmployee = this.employeeSelector.selectedEmployee;

			try {
				if (selectedEmployee) {
					const { tenantId } = this.store.user;
					await this.proposalsService.create({
						employeeId: selectedEmployee.id,
						organizationId: this.selectedOrganization.id,
						tenantId,
						jobPostUrl: result.jobPostUrl,
						valueDate: result.valueDate,
						jobPostContent: result.jobPostContent,
						proposalContent: result.proposalContent,
						status: ProposalStatusEnum.SENT,
						tags: this.tags
					});

					// TODO translate
					this.toastrService.primary(
						this.getTranslation(
							'NOTES.PROPOSALS.REGISTER_PROPOSAL'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);

					this.router.navigate(['/pages/sales/proposals']);
				} else {
					this.toastrService.primary(
						this.getTranslation(
							'NOTES.PROPOSALS.REGISTER_PROPOSAL_NO_EMPLOEE_SELECTED'
						),
						this.getTranslation(
							'TOASTR.MESSAGE.REGISTER_PROPOSAL_NO_EMPLOEE_MSG'
						)
					);
				}
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation(
						'NOTES.PROPOSALS.REGISTER_PROPOSAL_ERROR',
						{
							error: error.message
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
