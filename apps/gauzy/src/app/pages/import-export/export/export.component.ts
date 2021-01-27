import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExportAllService } from '../../../@core/services/exportAll.service';
import { saveAs } from 'file-saver';
import * as _ from 'lodash';
import { Store } from '../../../@core/services/store.service';
import { IOrganization } from '@gauzy/contracts';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

export interface IEntityModel {
	name: string;
	value?: string;
	checked: boolean;
	isGroup?: boolean;
	entities?: IEntityModel[];
}

@Component({
	selector: 'ngx-download',
	templateUrl: './export.component.html',
	styleUrls: ['./export.component.scss']
})
export class ExportComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	entities: Array<IEntityModel> = [];
	selectedEntities: string[] = [];
	checkedAll = true;
	organization: IOrganization;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private exportAll: ExportAllService,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.getEntities();
		this.onCheckboxChangeAll(this.checkedAll);
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				takeUntil(this._ngDestroy$)
			)
			.subscribe((organization) => {
				this.organization = organization;
			});
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	onCheckboxChangeAll(checked: boolean) {
		this.entities.forEach((entity) => {
			entity.checked = checked;
			if (entity.isGroup) {
				this.onCheckboxChange(checked, entity);
			}
		});
	}

	onCheckboxChange(checked: boolean, entity) {
		entity.checked = checked;
		if (entity.isGroup && entity.entities.length > 0) {
			entity.entities.forEach((t) => (t.checked = checked));
		}

		this.selectedCheckboxes();
	}

	selectedCheckboxes() {
		this.selectedEntities = [];
		const singleArray = JSON.parse(
			JSON.stringify(
				_.filter(
					this.entities,
					(entity: IEntityModel) => !entity.isGroup
				)
			)
		);
		const multipleArray = JSON.parse(
			JSON.stringify(
				_.filter(
					this.entities,
					(entity: IEntityModel) => entity.isGroup
				)
			)
		);

		this.selectedEntities = [].concat(...singleArray);

		multipleArray.forEach((item: any) => {
			this.selectedEntities = this.selectedEntities.concat(
				...item.entities
			);
			delete item.entities;
			this.selectedEntities = this.selectedEntities.concat(...item);
		});

		this.selectedEntities = _.map(
			_.filter(
				this.selectedEntities,
				(checkbox: IEntityModel) => checkbox.checked
			),
			(checkbox, i) => {
				return checkbox.value;
			}
		);
	}

	onSubmit() {
		const { id: organizationId, tenantId } = this.organization;
		this.exportAll
			.downloadSpecificData(this.selectedEntities, {
				organizationId,
				tenantId
			})
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => saveAs(data, `export.zip`));
	}

	onDownloadAll() {
		const { id: organizationId, tenantId } = this.organization;
		this.exportAll
			.downloadAllData({ organizationId, tenantId })
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => saveAs(data, `export.zip`));
	}

	getEntities() {
		this.entities = [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.ACTIVITY'),
				value: 'activity',
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.AVAILABILITY_SLOT'
				),
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
				value: 'event_types',
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
				entities: this.getInviteEntities()
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
				name: this.getTranslation('MENU.IMPORT_EXPORT.KNOWLAGE_BASE'),
				value: 'knowledge_base',
				checked: true,
				isGroup: true,
				entities: this.getKnowledgeBaseEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.LANGUAGE'),
				value: 'language',
				checked: true,
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
				isGroup: false,
				entities: []
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.REQUEST_APPROVAL'
				),
				value: 'request_approval',
				checked: true,
				isGroup: false,
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
				entities: this.getSkillEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.STAGE'),
				value: 'pipeline_stage',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG'),
				value: 'tag',
				checked: true,
				isGroup: false,
				entities: this.getTagEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TASK'),
				value: 'task',
				checked: true,
				isGroup: false,
				entities: this.getTaskEntities()
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TENANT'),
				value: 'tenant',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TIME_OFF_POLICY'),
				value: 'time_off_policy',
				checked: true,
				isGroup: true,
				entities: this.getTimeoffEntities()
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_CREATION_RATING'
				),
				value: 'candidate_creation_rating',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_DOCUMENT'
				),
				value: 'candidate_document',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_EDUCATION'
				),
				value: 'candidate_education',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_EXPERIENCE'
				),
				value: 'candidate_experience',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_FEEDBACK'
				),
				value: 'candidate_feedback',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_INTERVIEW'
				),
				value: 'candidate_interview',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_INTERVIEWER'
				),
				value: 'candidate_interviewer',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_PERSONAL_QUALITY'
				),
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_SOURCE'
				),
				value: 'candidate_source',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.CANDIDATE_TECHNOLOGY'
				),
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_AWARDS'
				),
				value: 'organization_award',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_CONTACT'
				),
				value: 'organization_contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Contact Employee', value: 'organization_contact_employee', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_DEPARTMENT'
				),
				value: 'organization_department',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Department Employee', value: 'organization_department_employee', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_DOCUMENT'
				),
				value: 'organization_document',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_EMPLOYEE_LEVEL'
				),
				value: 'organization_employee_level',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_EMPLOYMENT_TYPE'
				),
				value: 'organization_employment_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Employment Type Employee', value: 'organization_employment_type_employee', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_LANGUAGES'
				),
				value: 'organization_languages',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_POSITION'
				),
				value: 'organization_position',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_PROJECT'
				),
				value: 'organization_project',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Project Employee', value: 'organization_project_employee', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_RECURRING_EXPENSE'
				),
				value: 'organization_recurring_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_SPRINT'
				),
				value: 'organization_sprint',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_TEAM'
				),
				value: 'organization_team',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_TEAM_EMPLOYEE'
				),
				value: 'organization_team_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.ORGANIZATION_VENDOR'
				),
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
			// { name: 'Appointment Employees', value: 'appointment_employee', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.EMPLOYEE_APPOINTMENT'
				),
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.EMPLOYEE_PROPOSAL_TEMPLATE'
				),
				value: 'employee_proposal_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.EMPLOYEE_RECURRING_EXPENSE'
				),
				value: 'employee_recurring_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.EMPLOYEE_SETTING'
				),
				value: 'employee_setting',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getIntegrationEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INTEGRATION_ENTITY_SETTING'
				),
				value: 'integration_entity_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INTEGRATION_ENTITY_SETTING_TIED_ENTITY'
				),
				value: 'integration_entity_setting_tied_entity',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Integration Integration Type', value: 'integration_integration_type', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.INTEGRATION_MAP'),
				value: 'integration_map',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INTEGRATION_SETTING'
				),
				value: 'integration_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INTEGRATION_TENANT'
				),
				value: 'integration_tenant',
				checked: true,
				isGroup: false,
				entities: []
			}
			// { name: 'Integration Type', value: 'integration_type', checked: true, isGroup: false, entities: [] },
		];
	}

	getInviteEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INVITE_ORGANIZATION_CONTACT'
				),
				value: 'invite_organization_contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INVITE_ORGANIZATION_DEPARTMENT'
				),
				value: 'invite_organization_department',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INVITE_ORGANIZATION_PROJECT'
				),
				value: 'invite_organization_project',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getProductEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.PRODUCT_CATEGORY'
				),
				value: 'product_category',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Product Category Translation', value: 'product_category_translation', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_OPTION'),
				value: 'product_option',
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
			// { name: 'Product Type Translation', value: 'product_type_translation', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.PRODUCT_VARIANT'),
				value: 'product_variant',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Product Variant Options Product Option', value: 'product_variant_options_product_option', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.PRODUCT_VARIANT_PRICE'
				),
				value: 'product_variant_price',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.PRODUCT_VARIANT_SETTING'
				),
				value: 'product_variant_setting',
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
			}
		];
	}

	getRequestApprovalEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.REQUEST_APPROVAL_TAG'
				),
				value: 'tag_request_approval',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.REQUEST_APPROVAL_EMPLOYEE'
				),
				value: 'request_approval_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.REQUEST_APPROVAL_TEAM'
				),
				value: 'request_approval_team',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getSkillEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.SKILL_EMPLOYEE'),
				value: 'skill_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.SKILL_ORGANIZATION'
				),
				value: 'skill_organization',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTagEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_CANDIDATE'),
				value: 'tag_candidate',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_EMPLOYEE'),
				value: 'tag_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_EQUIPMENT'),
				value: 'tag_equipment',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_EVENT_TYPE'),
				value: 'tag_event_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_EXPENSE'),
				value: 'tag_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_ICNOME'),
				value: 'tag_income',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_INVOICE'),
				value: 'tag_invoice',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_CONTACT'
				),
				value: 'tag_organization_contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_DEPARTMENT'
				),
				value: 'tag_organization_department',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_EMPLOYEE_LEVEL'
				),
				value: 'tag_organization_employee_level',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_EMPLOYEE_TYPE'
				),
				value: 'tag_organization_employment_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_EXPENSES_CATEGORY'
				),
				value: 'tag_organization_expense_category',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_POSITION'
				),
				value: 'tag_organization_position',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_PROJECT'
				),
				value: 'tag_organization_project',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_TEAM'
				),
				value: 'tag_organization_team',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATION_VENDOR'
				),
				value: 'tag_organization_vendor',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TAG_ORGANIZATIONS'
				),
				value: 'tag_organization',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_PAYMENT'),
				value: 'tag_payment',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_PRODUCT'),
				value: 'tag_product',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_PROPOSAL'),
				value: 'tag_proposal',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_TASK'),
				value: 'tag_task',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TAG_USER'),
				value: 'tag_user',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTaskEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TASK_EMPLOYEE'),
				value: 'task_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.TASK_TEAM'),
				value: 'task_team',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getEquipmentEntities(): IEntityModel[] {
		return [
			// { name: 'Equipment Shares Employees', value: 'equipment_shares_employees', checked: true, isGroup: false, entities: [] },
			// { name: 'Equipment Shares Teams', value: 'equipment_shares_teams', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.EQUIPMENT_SHARING'
				),
				value: 'equipment_sharing',
				checked: true,
				isGroup: false,
				entities: []
			}
			// { name: 'Equipment Sharing Policy', value: 'equipment_sharing_policy', checked: true, isGroup: false, entities: [] },
		];
	}

	getExpenseEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.EXPENSE_CATEGORY'
				),
				value: 'expense_category',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getGoalEntities(): IEntityModel[] {
		return [
			// { name: 'Goal General Setting', value: 'goal_general_setting', checked: true, isGroup: false, entities: [] },
			{
				name: this.getTranslation('MENU.IMPORT_EXPORT.GOAL_KPI'),
				value: 'goal_kpi',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.GOAL_KPI_TEMPLATE'
				),
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.KNOWLAGE_BASE_ARTICLE'
				),
				value: 'knowledge_base_article',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.KNOWLAGE_BASE_AUTHOR'
				),
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.INVOICE_ESTIMATE_HISTORY'
				),
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.JOB_SEARCH_OCCUPATION'
				),
				value: 'job_search_occupation',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.JOB_SEARCH_CATEGORY'
				),
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.KEY_RESULT_TEMPLATE'
				),
				value: 'key_result_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.KEY_RESULT_UPDATE'
				),
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
				name: this.getTranslation('MENU.IMPORT_EXPORT.ROLE_PREMISSION'),
				value: 'role_permission',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTimeoffEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TIME_OFF_POLICY_EMPLOYEE'
				),
				value: 'time_off_policy_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TIME_OFF_REQUEST'
				),
				value: 'time_off_request',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TIME_OFF_REQUEST_EMPLOYEE'
				),
				value: 'time_off_request_employee',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTimesheetEntities(): IEntityModel[] {
		return [
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
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TIME_SLOT_MINUTES'
				),
				value: 'time_slot_minutes',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.TIME_SLOT_TIME_LOGOS'
				),
				value: 'time_slot_time_logs',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getUserEntities(): IEntityModel[] {
		return [
			{
				name: this.getTranslation(
					'MENU.IMPORT_EXPORT.USER_ORGANIIZATION'
				),
				value: 'user_organization',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}
}
