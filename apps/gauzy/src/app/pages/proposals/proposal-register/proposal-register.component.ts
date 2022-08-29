import {
	Component,
	OnInit,
	OnDestroy,
	AfterViewInit,
	ChangeDetectorRef
} from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	ITag,
	IOrganization,
	IEmployee,
	IEmployeeProposalTemplate,
	IOrganizationContact,
	ISelectedEmployee
} from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { NbDateService } from '@nebular/theme';
import * as moment from 'moment';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ProposalsService, Store, ToastrService } from '../../../@core/services';
import { ckEditorConfig } from "../../../@shared/ckeditor.config";
import { UrlPatternValidator } from '../../../@core/validators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposal-register',
	templateUrl: './proposal-register.component.html',
	styleUrls: ['././proposal-register.component.scss']
})
export class ProposalRegisterComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {

	proposalTemplate: IEmployeeProposalTemplate;
	proposalTemplateId: string;
	organization: IOrganization;
	tags: ITag[] = [];
	ckConfig: CKEditor4.Config = ckEditorConfig;
	minDate : Date;
	selectedEmployee: IEmployee;

	/*
	* Payment Mutation Form
	*/
	public form: FormGroup = ProposalRegisterComponent.buildForm(this.fb, this);
	static buildForm(
		fb: FormBuilder,
		self: ProposalRegisterComponent
	): FormGroup {
		return fb.group({
			jobPostUrl: [],
			valueDate: [
				self.store.getDateFromOrganizationSettings(),
				Validators.required
			],
			jobPostContent: ['', Validators.required],
			proposalContent: ['', Validators.required],
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
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly router: Router,
		private readonly proposalsService: ProposalsService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private readonly cdRef: ChangeDetectorRef,
    	private readonly dateService: NbDateService<Date>
	) {
		super(translateService);
    	this.minDate =  this.dateService.addMonth(this.dateService.today(), 0);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	/**
	 * Select Employee Selector
	 *
	 * @param employee
	 */
	selectionEmployee(employee: ISelectedEmployee) {
		if (employee) {
			this.form.patchValue({ employee: employee });
			this.form.updateValueAndValidity();
		}
		this.proposalTemplateId = null;
	}

	onProposalTemplateChange(item: IEmployeeProposalTemplate | null): void {
		if (isNotEmpty(item)) {
			this.form.patchValue({ proposalContent: item.content })
		} else {
			this.form.patchValue({ proposalContent: null })
		}
	}

	public async registerProposal() {
		if (!this.organization || this.form.invalid) {
			return;
		}
		const { jobPostUrl, valueDate, jobPostContent, proposalContent, organizationContact, tags } = this.form.getRawValue();
		const { employee } = this.form.getRawValue();
		try {
			if (employee) {
				const { tenantId } = this.store.user;
				const { id: organizationId } = this.organization;

				await this.proposalsService.create({
					employeeId: employee.id,
					organizationId,
					tenantId,
					jobPostUrl,
					valueDate: moment(valueDate).startOf('day').toDate(),
					jobPostContent,
					proposalContent,
					tags,
					organizationContactId: organizationContact ? organizationContact.id : null
				});

				// TODO translate
				this.toastrService.success(
					'NOTES.PROPOSALS.REGISTER_PROPOSAL'
				);

				this.router.navigate(['/pages/sales/proposals'], {
					queryParams: {
						date: moment(valueDate).format("MM-DD-YYYY")
					}
				});
			} else {
				this.toastrService.success(
					'NOTES.PROPOSALS.REGISTER_PROPOSAL_NO_EMPLOYEE_SELECTED',
					null,
					'TOASTR.MESSAGE.REGISTER_PROPOSAL_NO_EMPLOYEE_MSG'
				);
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	selectOrganizationContact(organizationContact: IOrganizationContact) {
		this.form.get('organizationContact').setValue(organizationContact);
		this.form.get('organizationContact').updateValueAndValidity();
	}

	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	ngOnDestroy(): void {}
}
