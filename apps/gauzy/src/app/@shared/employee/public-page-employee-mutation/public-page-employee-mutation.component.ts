import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	IEmployee,
	ISkill,
	IOrganizationEmploymentType,
	ITag,
	PayPeriodEnum,
	LanguagesEnum,
	IEmployeeAward,
	IEmployeeLevel
} from '@gauzy/contracts';
import {
	switchMap,
	map,
	tap,
	filter,
	catchError
} from 'rxjs/operators';
import { Observable, EMPTY } from 'rxjs';
import { TranslationBaseComponent } from '../../language-base';
import {
	EmployeeAwardService,
	EmployeeLevelService,
	ErrorHandlingService,
	OrganizationEmploymentTypesService,
	Store,
	ToastrService
} from '../../../@core/services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ckEditorConfig } from "../../ckeditor.config";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-public-page-employee-mutation',
	templateUrl: './public-page-employee-mutation.component.html',
	styleUrls: ['./public-page-employee-mutation.component.scss'],
	providers: []
})
export class PublicPageEmployeeMutationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	employee: IEmployee;
	form: FormGroup;
	employmentTypes$: Observable<IOrganizationEmploymentType[]>;
	employeeLevels: IEmployeeLevel[] = [];
	payPeriods = Object.values(PayPeriodEnum);
	languages: string[] = Object.values(LanguagesEnum);
	privacySettings: any[];
	employeeAwards: IEmployeeAward[];
	showAddAward: boolean;
	ckConfig: any = {
		...ckEditorConfig,
		height: "200"
	};

	constructor(
		private readonly fb: FormBuilder,
		protected readonly dialogRef: NbDialogRef<PublicPageEmployeeMutationComponent>,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly organizationEmploymentTypeService: OrganizationEmploymentTypesService,
		private readonly employeeLevelService: EmployeeLevelService,
		private readonly employeeAwardService: EmployeeAwardService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this._fillPrivacySettings();
		this._initForm();

		this.employmentTypes$ = this.store.selectedOrganization$.pipe(
			filter((organization) => !!organization),
			tap(async (organization) => {
				const { tenantId } = this.store.user;
				const { id: organizationId } = organization;
				const { items } = await this.employeeLevelService.getAll([], {
					tenantId,
					organizationId
				});
				this.employeeLevels = items;
			}),
			switchMap((organization) =>
				this.organizationEmploymentTypeService.getAll([], {
					organizationId: organization.id
				})
			),
			map(({ items }) => items),
			untilDestroyed(this)
		);
	}

	private _fillPrivacySettings() {
		const {
			show_anonymous_bonus,
			show_average_bonus,
			show_average_expenses,
			show_average_income,
			show_billrate,
			show_payperiod,
			show_start_work_on
		} = this.employee;

		const privacySettings = {
			show_anonymous_bonus,
			show_average_bonus,
			show_average_expenses,
			show_average_income,
			show_billrate,
			show_payperiod,
			show_start_work_on
		};

		this.privacySettings = Object.keys(privacySettings).map((key) => ({
			key,
			value: privacySettings[key],
			translation: `POP_UPS.${key.toUpperCase()}`
		}));
	}

	private _initForm() {
		this.form = this.fb.group({
			username: this.employee.user.username,
			email: [this.employee.user.email, Validators.required],
			firstName: this.employee.user.firstName,
			lastName: this.employee.user.lastName,
			preferredLanguage: this.employee.user.preferredLanguage,
			short_description: this.employee.short_description,
			description: this.employee.description,
			billRateValue: this.employee.billRateValue,
			billRateCurrency: [this.employee.billRateCurrency],
			reWeeklyLimit: this.employee.reWeeklyLimit,
			startedWorkOn: this.employee.startedWorkOn,
			organizationEmploymentTypes: [
				this.employee.organizationEmploymentTypes || null
			],
			employeeLevel: this.employee.employeeLevel,
			tags: this.employee.tags,
			payPeriod: this.employee.payPeriod,
			show_anonymous_bonus: this.employee.show_anonymous_bonus,
			show_average_bonus: this.employee.show_average_bonus,
			show_average_expenses: this.employee.show_average_expenses,
			show_average_income: this.employee.show_average_income,
			show_billrate: this.employee.show_billrate,
			show_payperiod: this.employee.show_payperiod,
			show_start_work_on: this.employee.show_start_work_on,
			skills: this.employee.skills,
			anonymousBonus: this.employee.anonymousBonus
		});
	}

	selectedSkillsHandler(skill: ISkill) {
		this.form.get('skills').setValue(skill);
		this.form.updateValueAndValidity();
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
		this.form.updateValueAndValidity();
	}

	close() {
		this.dialogRef.close();
	}

	updateEmployee() {
		if (this.form.valid) {
			this.dialogRef.close(this.form.value);
		}
	}

	addAward(name, year) {
		if (name && year) {
			const employeeAwardCreateDto = {
				name,
				year,
				employeeId: this.employee.id
			};

			this.employeeAwardService
				.create(employeeAwardCreateDto)
				.pipe(
					tap((award) => this.employeeAwards.push(award)),
					tap(() => {
						this.showAddAward = false;
						this.toastrService.success(
							'NOTES.EMPLOYEE.EDIT_EMPLOYEE_AWARDS.ADD_AWARD',
							{
								name
							}
						);
					}),
					catchError((err) => {
						this.errorHandlingService.handleError(err);
						return EMPTY;
					}),
					untilDestroyed(this)
				)
				.subscribe();
		} else {
			this.toastrService.danger(
				'NOTES.EMPLOYEE.EDIT_EMPLOYEE_AWARDS.INVALID_AWARD_NAME_YEAR',
				'TOASTR.MESSAGE.NEW_ORGANIZATION_AWARD_INVALID_NAME'
			);
		}
	}

	async removeAward(award) {
		this.employeeAwardService
			.delete(award.id)
			.pipe(
				tap(
					() =>
						(this.employeeAwards = this.employeeAwards.filter(
							(a) => a.id !== award.id
						))
				),
				tap(() => {
					this.toastrService.success(
						'NOTES.EMPLOYEE.EDIT_EMPLOYEE_AWARDS.REMOVE_AWARD',
						{
							name
						}
					);
				}),
				catchError((err) => {
					this.errorHandlingService.handleError(err);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }
}
