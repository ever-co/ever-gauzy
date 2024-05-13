import { AfterViewInit, Component, OnInit } from '@angular/core';
import { isNotEmpty } from '@gauzy/common-angular';
import { saveAs } from 'file-saver';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as _ from 'underscore';
import { Subject } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { IEntityModel } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ExportAllService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-export',
	templateUrl: './export.component.html',
	styleUrls: ['./export.component.scss']
})
export class ExportComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	entities: Array<IEntityModel> = [];
	selectedEntities: string[] = [];
	selectedModels: Array<IEntityModel> = [];
	checkedAll: boolean;
	subject$: Subject<any> = new Subject();
	loading: boolean;

	constructor(private readonly exportAll: ExportAllService, public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				tap(() => (this.checkedAll = true)),
				tap(() => this.getEntities()),
				tap(() => this.onCheckboxChangeAll(this.checkedAll)),
				untilDestroyed(this)
			)
			.subscribe();

		this.subject$.next(true);
	}

	ngAfterViewInit() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onCheckboxChangeAll(checked: boolean) {
		this.entities.forEach((entity: IEntityModel) => {
			entity.checked = checked;
			if (entity.isGroup) {
				this.onCheckboxChange(checked, entity);
			}
		});
	}

	onCheckboxChange(checked: boolean, entity: IEntityModel) {
		entity.checked = checked;
		if (entity.isGroup && isNotEmpty(entity.entities)) {
			entity.entities.forEach((t: IEntityModel) => (t.checked = checked));
		}
		this.selectedCheckboxes();
	}

	selectedCheckboxes() {
		const singleArray = JSON.parse(
			JSON.stringify(_.filter(this.entities, (entity: IEntityModel) => !entity.isGroup))
		);
		const multipleArray = JSON.parse(
			JSON.stringify(_.filter(this.entities, (entity: IEntityModel) => entity.isGroup))
		);

		this.selectedModels = [];
		this.selectedModels.push(...singleArray);

		multipleArray.forEach((item: any) => {
			this.selectedModels.push(...item.entities);
			if ('entities' in item) {
				delete item.entities;
			}

			this.selectedModels.push(item);
		});

		this.selectedEntities = _.map(
			_.filter(this.selectedModels, (checkbox: IEntityModel) => checkbox.checked),
			(checkbox: any, i) => {
				return checkbox.value;
			}
		);
	}

	onSubmit() {
		this.loading = true;
		const entities = this.selectedEntities.filter(isNotEmpty);
		this.exportAll
			.downloadSpecificTable(entities)
			.pipe(
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe((data) => saveAs(data, `archive.zip`));
	}

	getEntities() {
		this.entities = [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ACCOUNTING_TEMPLATE'),
				value: 'accounting_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.APPROVAL_POLICY'),
				value: 'approval_policy',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.AVAILABILITY_SLOT'),
				value: 'availability_slot',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE'),
				value: 'candidate',
				checked: true,
				isGroup: true,
				entities: this.getCandidateEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CONTACT'),
				value: 'contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CUSTOM_SMTP'),
				value: 'custom_smtp',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.COUNTRY'),
				value: 'country',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CURRENCY'),
				value: 'currency',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.DEAL'),
				value: 'deal',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMAIL'),
				value: 'email',
				checked: true,
				isGroup: true,
				entities: this.getEmailEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMPLOYEE'),
				value: 'employee',
				checked: true,
				isGroup: true,
				entities: this.getEmployeeEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EQUIPMENT'),
				value: 'equipment',
				checked: true,
				isGroup: true,
				entities: this.getEquipmentEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EVENT_TYPES'),
				value: 'event_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EXPENSE'),
				value: 'expense',
				checked: true,
				isGroup: true,
				entities: this.getExpenseEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.FEATURE'),
				value: 'feature',
				checked: true,
				isGroup: true,
				entities: this.getFeatureEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.GOAL'),
				value: 'goal',
				checked: true,
				isGroup: true,
				entities: this.getGoalEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INCOME'),
				value: 'income',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION'),
				value: 'integration',
				checked: true,
				isGroup: true,
				entities: this.getIntegrationEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INVITE'),
				value: 'invite',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INVOICE'),
				value: 'invoice',
				checked: true,
				isGroup: true,
				entities: this.getInvoiceEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.JOB'),
				value: null,
				checked: true,
				isGroup: true,
				entities: this.getJobEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.KEY_RESULT'),
				value: 'key_result',
				checked: true,
				isGroup: true,
				entities: this.getKeyResultEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.KNOWLEDGE_BASE'),
				value: 'knowledge_base',
				checked: true,
				isGroup: true,
				entities: this.getKnowledgeBaseEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.LANGUAGE'),
				value: 'language',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION'),
				value: 'organization',
				checked: true,
				isGroup: true,
				entities: this.getOrganizationEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PAYMENT'),
				value: 'payment',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PIPELINE'),
				value: 'pipeline',
				checked: true,
				isGroup: true,
				entities: this.getPipelineEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT'),
				value: 'product',
				checked: true,
				isGroup: true,
				entities: this.getProductEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PROPOSAL'),
				value: 'proposal',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.REPORT'),
				value: 'report',
				checked: true,
				isGroup: true,
				entities: this.getReportEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.REQUEST_APPROVAL'),
				value: 'request_approval',
				checked: true,
				isGroup: true,
				entities: this.getRequestApprovalEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ROLE'),
				value: 'role',
				checked: true,
				isGroup: true,
				entities: this.getRoleEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.SKILL'),
				value: 'skill',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG'),
				value: 'tag',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TASK'),
				value: 'task',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TENANT'),
				value: 'tenant',
				checked: true,
				isGroup: true,
				entities: this.getTenantEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TIME_OFF_POLICY'),
				value: 'time_off_policy',
				checked: true,
				isGroup: true,
				entities: this.getTimeOffEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TIME_SHEET'),
				value: 'timesheet',
				checked: true,
				isGroup: true,
				entities: this.getTimesheetEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.USER'),
				value: 'user',
				checked: true,
				isGroup: true,
				entities: this.getUserEntities()
			}
		];
	}

	getCandidateEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_CRITERION_RATING'),
				value: 'candidate_criterion_rating',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_DOCUMENT'),
				value: 'candidate_document',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_EDUCATION'),
				value: 'candidate_education',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_EXPERIENCE'),
				value: 'candidate_experience',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_FEEDBACK'),
				value: 'candidate_feedback',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_INTERVIEW'),
				value: 'candidate_interview',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_INTERVIEWER'),
				value: 'candidate_interviewer',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_PERSONAL_QUALITY'),
				value: 'candidate_personal_quality',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_SKILL'),
				value: 'candidate_skill',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_SOURCE'),
				value: 'candidate_source',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.CANDIDATE_TECHNOLOGY'),
				value: 'candidate_technology',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getOrganizationEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_AWARD'),
				value: 'organization_award',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_CONTACT'),
				value: 'organization_contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_DEPARTMENT'),
				value: 'organization_department',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_DOCUMENT'),
				value: 'organization_document',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_EMPLOYEE_LEVEL'),
				value: 'organization_employee_level',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_EMPLOYMENT_TYPE'),
				value: 'organization_employment_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_LANGUAGES'),
				value: 'organization_language',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_POSITION'),
				value: 'organization_position',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_PROJECT'),
				value: 'organization_project',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_RECURRING_EXPENSE'),
				value: 'organization_recurring_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_SPRINT'),
				value: 'organization_sprint',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_TEAM'),
				value: 'organization_team',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_TEAM_EMPLOYEE'),
				value: 'organization_team_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ORGANIZATION_VENDOR'),
				value: 'organization_vendor',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getEmailEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMAIL_TEMPLATE'),
				value: 'email_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ESTIMATE_EMAIL'),
				value: 'estimate_email',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getEmployeeEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMPLOYEE_APPOINTMENT'),
				value: 'employee_appointment',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMPLOYEE_AWARD'),
				value: 'employee_award',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMPLOYEE_PROPOSAL_TEMPLATE'),
				value: 'employee_proposal_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMPLOYEE_RECURRING_EXPENSE'),
				value: 'employee_recurring_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMPLOYEE_SETTING'),
				value: 'employee_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EMPLOYEE_UPWORK_JOB_SEARCH_CRITERION'),
				value: 'employee_upwork_job_search_criterion',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getIntegrationEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION_TYPE'),
				value: 'integration_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION_ENTITY_SETTING'),
				value: 'integration_entity_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION_ENTITY_SETTING_TIED_ENTITY'),
				value: 'integration_entity_setting_tied_entity',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION_MAP'),
				value: 'integration_map',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION_SETTING'),
				value: 'integration_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION_TENANT'),
				value: 'integration_tenant',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getProductEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_CATEGORY'),
				value: 'product_category',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_CATEGORY_TRANSLATION'),
				value: 'product_category_translation',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_OPTION'),
				value: 'product_option',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_OPTION_GROUP'),
				value: 'product_option_group',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_OPTION_GROUP_TRANSLATION'),
				value: 'product_option_group_translation',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_OPTION_TRANSLATION'),
				value: 'product_option_translation',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_STORE'),
				value: 'product_store',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_TRANSLATION'),
				value: 'product_translation',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_TYPE'),
				value: 'product_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_TYPE_TRANSLATION'),
				value: 'product_type_translation',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_VARIANT'),
				value: 'product_variant',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_VARIANT_PRICE'),
				value: 'product_variant_price',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_VARIANT_SETTING'),
				value: 'product_variant_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_IMAGE_ASSET'),
				value: 'image_asset',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.WAREHOUSE'),
				value: 'warehouse',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.MERCHANT'),
				value: 'merchant',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.WAREHOUSE_PRODUCT'),
				value: 'warehouse_product',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.WAREHOUSE_PRODUCT_VARIANT'),
				value: 'warehouse_product_variant',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getReportEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.REPORT_CATEGORY'),
				value: 'report_category',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.REPORT_ORGANIZATION'),
				value: 'report_organization',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getRequestApprovalEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.REQUEST_APPROVAL_EMPLOYEE'),
				value: 'request_approval_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.REQUEST_APPROVAL_TEAM'),
				value: 'request_approval_team',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getEquipmentEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EQUIPMENT_SHARING'),
				value: 'equipment_sharing',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EQUIPMENT_SHARE_POLICY'),
				value: 'equipment_sharing_policy',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getExpenseEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.EXPENSE_CATEGORY'),
				value: 'expense_category',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getFeatureEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.FEATURE_ORGANIZATION'),
				value: 'feature_organization',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getGoalEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.GOAL_GENERAL_SETTING'),
				value: 'goal_general_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.GOAL_KPI'),
				value: 'goal_kpi',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.GOAL_KPI_TEMPLATE'),
				value: 'goal_kpi_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.GOAL_TEMPLATE'),
				value: 'goal_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.GOAL_TIME_FRAME'),
				value: 'goal_time_frame',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getKnowledgeBaseEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.KNOWLEDGE_BASE_ARTICLE'),
				value: 'knowledge_base_article',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.KNOWLEDGE_BASE_AUTHOR'),
				value: 'knowledge_base_author',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getInvoiceEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INVOICE_ESTIMATE_HISTORY'),
				value: 'invoice_estimate_history',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INVOICE_ITEM'),
				value: 'invoice_item',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getJobEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.JOB_PRESET'),
				value: 'job_preset',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.JOB_PRESET_UPWORK_SEARCH_CRITERION'),
				value: 'job_preset_upwork_job_search_criterion',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.JOB_SEARCH_OCCUPATION'),
				value: 'job_search_occupation',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.JOB_SEARCH_CATEGORY'),
				value: 'job_search_category',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getKeyResultEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.KEY_RESULT_TEMPLATE'),
				value: 'key_result_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.KEY_RESULT_UPDATE'),
				value: 'key_result_update',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getRoleEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ROLE_PERMISSION'),
				value: 'role_permission',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTimeOffEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TIME_OFF_REQUEST'),
				value: 'time_off_request',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTimesheetEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ACTIVITY'),
				value: 'activity',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.SCREENSHOT'),
				value: 'screenshot',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TIME_LOG'),
				value: 'time_log',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TIME_SLOT'),
				value: 'time_slot',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TIME_SLOT_MINUTES'),
				value: 'time_slot_minute',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getUserEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.USER_ORGANIZATION'),
				value: 'user_organization',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getPipelineEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PIPELINE_STAGE'),
				value: 'pipeline_stage',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTenantEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TENANT_SETTING'),
				value: 'tenant_setting',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}
}
