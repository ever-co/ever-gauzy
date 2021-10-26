import {
	Component,
	OnInit,
	ViewChild,
	OnDestroy,
	AfterViewInit,
	ChangeDetectorRef
} from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	ProposalStatusEnum,
	ITag,
	IOrganization,
	IEmployee,
	IEmployeeProposalTemplate,
	IOrganizationContact
} from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ProposalsService, Store, ToastrService } from '../../../@core/services';

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
	organization: IOrganization;
	organizationContact: IOrganizationContact;
	tags: ITag[] = [];

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
	minDate = new Date(moment().subtract(1, 'days').format('YYYY-MM-DD'));
	selectedEmployee: IEmployee;

	/*
	* Payment Mutation Form
	*/
	public form: FormGroup = ProposalRegisterComponent.buildForm(this.fb);
	static buildForm( fb: FormBuilder): FormGroup {
		return fb.group({
			jobPostUrl: [
				'',
				Validators.compose([
					Validators.pattern(
						new RegExp(
							/^((?:https?:\/\/)[^./]+(?:\.[^./]+)+(?:\/.*)?)$/
						)
					)
				])
			],
			valueDate: [new Date(), Validators.required],
			jobPostContent: ["", Validators.required],
			proposalContent: ["", Validators.required],
			tags: [],
			organizationContact: []
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
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	onEmployeeChange(item: IEmployee): void {
		this.selectedEmployee = item;
		this.proposalTemplateId = null;
	}

	onProposalTemplateChange(item: IEmployeeProposalTemplate | null): void {
		if (isNotEmpty(item)) {
			this.form.patchValue({ proposalContent: item.content })
		} else {
			this.form.patchValue({ proposalContent: null })
		}
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	public async registerProposal() {
		if (this.form.invalid) {
			return;
		}

		const { jobPostUrl, valueDate, jobPostContent, proposalContent, organizationContact, tags } = this.form.value;
		const selectedEmployee = this.employeeSelector.selectedEmployee;

		try {
			if (selectedEmployee) {
				const { tenantId } = this.store.user;
				const { id: organizationId } = this.organization;
				await this.proposalsService.create({
					employeeId: selectedEmployee.id,
					organizationId,
					tenantId,
					jobPostUrl,
					valueDate,
					jobPostContent,
					proposalContent,
					status: ProposalStatusEnum.SENT,
					tags,
					organizationContactId: organizationContact ? organizationContact.id : null
				});

				// TODO translate
				this.toastrService.success(
					'NOTES.PROPOSALS.REGISTER_PROPOSAL'
				);

				this.router.navigate(['/pages/sales/proposals']);
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

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}

	selectedTagsEvent(ev) {
		this.form.patchValue({
			tags: ev
		});
	}
}
