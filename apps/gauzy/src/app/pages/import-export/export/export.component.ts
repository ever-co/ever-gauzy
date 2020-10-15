import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExportAllService } from '../../../@core/services/exportAll.service';
import { saveAs } from 'file-saver';
import { Router } from '@angular/router';
import * as _ from 'lodash';
import { Store } from '../../../@core/services/store.service';
import { IOrganization } from '@gauzy/models';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

export interface IEntityModel {
	name: string;
	value: string;
	checked: boolean;
	isGroup?: boolean;
	entities?: IEntityModel[];
}

@Component({
	selector: 'ngx-download',
	templateUrl: './export.component.html',
	styleUrls: ['./export.component.scss']
})
export class ExportComponent implements OnInit, OnDestroy {
	entities: Array<IEntityModel> = [];
	selectedEntities: string[] = [];
	checkedAll = true;
	organization: IOrganization;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private exportAll: ExportAllService,
		private router: Router,
		private store: Store
	) {}

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

	onDownloadTemplates() {
		this.exportAll
			.downloadTemplates()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => saveAs(data, `template.zip`));
	}

	importPage() {
		this.router.navigate(['/pages/settings/import-export/import']);
	}

	getEntities() {
		this.entities = [
			{
				name: 'Activity',
				value: 'activity',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Approval Policy',
				value: 'approval_policy',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Availability Slot',
				value: 'availability_slot',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate',
				value: 'candidate',
				checked: true,
				isGroup: true,
				entities: this.getCandidateEntities()
			},
			{
				name: 'Contact',
				value: 'contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Country',
				value: 'country',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Deal',
				value: 'deal',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Email',
				value: 'email',
				checked: true,
				isGroup: true,
				entities: this.getEmailEntities()
			},
			{
				name: 'Employee',
				value: 'employee',
				checked: true,
				isGroup: true,
				entities: this.getEmployeeEntities()
			},
			{
				name: 'Equipment',
				value: 'equipment',
				checked: true,
				isGroup: true,
				entities: this.getEquipmentEntities()
			},
			{
				name: 'Event Types',
				value: 'event_types',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Expense',
				value: 'expense',
				checked: true,
				isGroup: true,
				entities: this.getExpenseEntities()
			},
			{
				name: 'Goal',
				value: 'goal',
				checked: true,
				isGroup: true,
				entities: this.getGoalEntities()
			},
			{
				name: 'Income',
				value: 'income',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Integration',
				value: 'integration',
				checked: true,
				isGroup: true,
				entities: this.getIntegrationEntities()
			},
			{
				name: 'Invite',
				value: 'invite',
				checked: true,
				isGroup: false,
				entities: this.getInviteEntities()
			},
			{
				name: 'Invoice',
				value: 'invoice',
				checked: true,
				isGroup: true,
				entities: this.getInvoiceEntities()
			},
			{
				name: 'Key Result',
				value: 'key_result',
				checked: true,
				isGroup: true,
				entities: this.getKeyResultEntities()
			},
			{
				name: 'Knowledge Base',
				value: 'knowledge_base',
				checked: true,
				isGroup: true,
				entities: this.getKnowledgeBaseEntities()
			},
			{
				name: 'Language',
				value: 'language',
				checked: true,
				entities: []
			},
			{
				name: 'Organization',
				value: 'organization',
				checked: true,
				isGroup: true,
				entities: this.getOrganizationEntities()
			},
			{
				name: 'Payment',
				value: 'payment',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Pipeline',
				value: 'pipeline',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Product',
				value: 'product',
				checked: true,
				isGroup: true,
				entities: this.getProductEntities()
			},
			{
				name: 'Proposal',
				value: 'proposal',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Request Approval',
				value: 'request_approval',
				checked: true,
				isGroup: false,
				entities: this.getRequestApprovalEntities()
			},
			{
				name: 'Role',
				value: 'role',
				checked: true,
				isGroup: true,
				entities: this.getRoleEntities()
			},
			{
				name: 'Skill',
				value: 'skill',
				checked: true,
				isGroup: false,
				entities: this.getSkillEntities()
			},
			{
				name: 'Stage',
				value: 'pipeline_stage',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag',
				value: 'tag',
				checked: true,
				isGroup: false,
				entities: this.getTagEntities()
			},
			{
				name: 'Task',
				value: 'task',
				checked: true,
				isGroup: false,
				entities: this.getTaskEntities()
			},
			{
				name: 'Tenant',
				value: 'tenant',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Time off Policy',
				value: 'time_off_policy',
				checked: true,
				isGroup: true,
				entities: this.getTimeoffEntities()
			},
			{
				name: 'Time Sheet',
				value: 'timesheet',
				checked: true,
				isGroup: true,
				entities: this.getTimesheetEntities()
			},
			{
				name: 'User',
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
				name: 'Candidate Creation Rating',
				value: 'candidate_creation_rating',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Document',
				value: 'candidate_document',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Education',
				value: 'candidate_education',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Experience',
				value: 'candidate_experience',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Feedback',
				value: 'candidate_feedback',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Interview',
				value: 'candidate_interview',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Interviewer',
				value: 'candidate_interviewer',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Personal Quality',
				value: 'candidate_personal_quality',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Skill',
				value: 'candidate_skill',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Source',
				value: 'candidate_source',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Candidate Technology',
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
				name: 'Organization Awards',
				value: 'organization_award',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Contact',
				value: 'organization_contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Contact Employee', value: 'organization_contact_employee', checked: true, isGroup: false, entities: [] },
			{
				name: 'Organization Department',
				value: 'organization_department',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Department Employee', value: 'organization_department_employee', checked: true, isGroup: false, entities: [] },
			{
				name: 'Organization Document',
				value: 'organization_document',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Employee Level',
				value: 'organization_employee_level',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Employment Type',
				value: 'organization_employment_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Employment Type Employee', value: 'organization_employment_type_employee', checked: true, isGroup: false, entities: [] },
			{
				name: 'Organization Languages',
				value: 'organization_languages',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Position',
				value: 'organization_position',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Project',
				value: 'organization_project',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Organization Project Employee', value: 'organization_project_employee', checked: true, isGroup: false, entities: [] },
			{
				name: 'Organization Recurring Expense',
				value: 'organization_recurring_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Sprint',
				value: 'organization_sprint',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Team',
				value: 'organization_team',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Team Employee',
				value: 'organization_team_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Organization Vendor',
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
				name: 'Email Template',
				value: 'email_template',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Estimate Email',
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
				name: 'Employee Appointment',
				value: 'employee_appointment',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Employee Award', value: 'employee_award', checked: true, isGroup: false, entities: [] },
			{
				name: 'Employee Recurring Expense',
				value: 'employee_recurring_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Employee Setting',
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
				name: 'Integration Entity Setting',
				value: 'integration_entity_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Integration Entity Setting Tied Entity',
				value: 'integration_entity_setting_tied_entity',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Integration Integration Type', value: 'integration_integration_type', checked: true, isGroup: false, entities: [] },
			{
				name: 'Integration Map',
				value: 'integration_map',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Integration Setting',
				value: 'integration_setting',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Integration Tenant',
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
				name: 'Invite Organization Contact',
				value: 'invite_organization_contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Invite Organization Department',
				value: 'invite_organization_department',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Invite Organization Project',
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
				name: 'Product Category',
				value: 'product_category',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Product Category Translation', value: 'product_category_translation', checked: true, isGroup: false, entities: [] },
			{
				name: 'Product Option',
				value: 'product_option',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Product Type',
				value: 'product_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Product Type Translation', value: 'product_type_translation', checked: true, isGroup: false, entities: [] },
			{
				name: 'Product Variant',
				value: 'product_variant',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Product Variant Options Product Option', value: 'product_variant_options_product_option', checked: true, isGroup: false, entities: [] },
			{
				name: 'Product Variant Price',
				value: 'product_variant_price',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Product Variant Setting',
				value: 'product_variant_setting',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getRequestApprovalEntities(): IEntityModel[] {
		return [
			{
				name: 'Request Approval Tag',
				value: 'tag_request_approval',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Request Approval Employee',
				value: 'request_approval_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Request Approval Team',
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
				name: 'Skill Employee',
				value: 'skill_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Skill Organization',
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
				name: 'Tag Candidate',
				value: 'tag_candidate',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Employee',
				value: 'tag_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Equipment',
				value: 'tag_equipment',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Event Type',
				value: 'tag_event_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Expense',
				value: 'tag_expense',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Income',
				value: 'tag_income',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Invoice',
				value: 'tag_invoice',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Contact',
				value: 'tag_organization_contact',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Department',
				value: 'tag_organization_department',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Employee Level',
				value: 'tag_organization_employee_level',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Employment Type',
				value: 'tag_organization_employment_type',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Expense Category',
				value: 'tag_organization_expense_category',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Position',
				value: 'tag_organization_position',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Project',
				value: 'tag_organization_project',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Team',
				value: 'tag_organization_team',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organization Vendor',
				value: 'tag_organization_vendor',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Organizations',
				value: 'tag_organization',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Payment',
				value: 'tag_payment',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Product',
				value: 'tag_product',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Proposal',
				value: 'tag_proposal',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag Task',
				value: 'tag_task',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Tag User',
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
				name: 'Task Employee',
				value: 'task_employee',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Task Team',
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
				name: 'Equipment Sharing',
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
				name: 'Expense Category',
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
				name: 'Goal Kpi',
				value: 'goal_kpi',
				checked: true,
				isGroup: false,
				entities: []
			},
			// { name: 'Goal Kpi Template', value: 'goal_kpi_template', checked: true, isGroup: false, entities: [] },
			// { name: 'Goal Template', value: 'goal_template', checked: true, isGroup: false, entities: [] },
			{
				name: 'Goal Time Frame',
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
				name: 'Knowledge Base Article',
				value: 'knowledge_base_article',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Knowledge Base Author',
				value: 'knowledge_base_author',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getInvoiceEntities(): IEntityModel[] {
		return [
			// { name: 'Invoice Estimate History', value: 'invoice_estimate_history', checked: true, isGroup: false, entities: [] },
			{
				name: 'Invoice Item',
				value: 'invoice_item',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getKeyResultEntities(): IEntityModel[] {
		return [
			// { name: 'Key Result Template', value: 'key_result_template', checked: true, isGroup: false, entities: [] },
			{
				name: 'Key Result Update',
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
				name: 'Role Permission',
				value: 'role_permission',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}

	getTimeoffEntities(): IEntityModel[] {
		return [
			// { name: 'Time Off Policy Employee', value: 'time_off_policy_employee', checked: true, isGroup: false, entities: [] },
			{
				name: 'Time Off Request',
				value: 'time_off_request',
				checked: true,
				isGroup: false,
				entities: []
			}
			// { name: 'Time Off Request Employee', value: 'time_off_request_employee', checked: true, isGroup: false, entities: [] },
		];
	}

	getTimesheetEntities(): IEntityModel[] {
		return [
			{
				name: 'Screenshot',
				value: 'screenshot',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Time Log',
				value: 'time_log',
				checked: true,
				isGroup: false,
				entities: []
			},
			{
				name: 'Time Slot',
				value: 'time_slot',
				checked: true,
				isGroup: false,
				entities: []
			}
			// { name: 'Time Slot Minutes', value: 'time_slot_minutes', checked: true, isGroup: false,  entities: [] },
			// { name: 'Time Slot Time Logs', value: 'time_slot_time_logs', checked: true, isGroup: false,  entities: [] },
		];
	}

	getUserEntities(): IEntityModel[] {
		return [
			{
				name: 'User Organization',
				value: 'user_organization',
				checked: true,
				isGroup: false,
				entities: []
			}
		];
	}
}
