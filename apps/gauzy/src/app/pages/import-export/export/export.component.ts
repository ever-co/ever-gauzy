import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExportAllService } from '../../../@core/services/exportAll.service';
import { saveAs } from 'file-saver';
import { Router } from '@angular/router';
import { FormArray, FormGroup, FormControl } from '@angular/forms';
import * as _ from 'lodash';
@Component({
	selector: 'ngx-download',
	templateUrl: './export.component.html',
	styleUrls: ['./export.component.scss']
})
export class ExportComponent implements OnInit, OnDestroy {
	form: FormGroup;
	selectedfiles: string[];
	files: Array<any> = [
		{ name: 'Activity', value: 'activity', checked: 'true' },
		{
			name: 'Appointment Employees',
			value: 'appointment_employees',
			checked: 'true'
		},
		{
			name: 'Approval Policy',
			value: 'approval_policy',
			checked: 'true'
		},
		{
			name: 'Availability Slots',
			value: 'availability_slots',
			checked: 'true'
		},
		{ name: 'Candidate', value: 'candidate', checked: 'true' },
		{
			name: 'Candidate Creation Rating',
			value: 'candidate_creation_rating',
			checked: 'true'
		},
		{
			name: 'Candidate Documents',
			value: 'candidate_documents',
			checked: 'true'
		},
		{
			name: 'Candidate Education',
			value: 'candidate_education',
			checked: 'true'
		},
		{
			name: 'Candidate Experience',
			value: 'candidate_experience',
			checked: 'true'
		},
		{
			name: 'Candidate Feedbacks',
			value: 'candidate_feedbacks',
			checked: 'true'
		},
		{
			name: 'Candidate Interview',
			value: 'candidate_interview',
			checked: 'true'
		},
		{
			name: 'Candidate Interviews',
			value: 'candidate_interviews',
			checked: 'true'
		},
		{
			name: 'Candidate Personal Qualities',
			value: 'candidate_personal_qualities',
			checked: 'true'
		},
		{ name: 'Candidate Skill', value: 'candidate_skill', checked: 'true' },
		{
			name: 'Candidate Source',
			value: 'candidate_source',
			checked: 'true'
		},
		{
			name: 'Candidate Technologies',
			value: 'candidate_technologies',
			checked: 'true'
		},
		{ name: 'Countries', value: 'countries', checked: 'true' },
		{ name: 'Contact', value: 'contact', checked: 'true' },
		{ name: 'Deal', value: 'deal', checked: 'true' },
		{ name: 'Email', value: 'email', checked: 'true' },
		{ name: 'Email Template', value: 'email_template', checked: 'true' },
		{ name: 'Estimate Email', value: 'estimate_email', checked: 'true' },
		{ name: 'Employee', value: 'employee', checked: 'true' },
		{
			name: 'Employee Appointment',
			value: 'employee_appointment',
			checked: 'true'
		},
		{
			name: 'Employee Reccuring Expense',
			value: 'employee_recurring_expense',
			checked: 'true'
		},
		{
			name: 'Employee Setting',
			value: 'employee_setting',
			checked: 'true'
		},
		{ name: 'Equipment', value: 'equipment', checked: 'true' },
		{
			name: 'Equipment Sharing',
			value: 'equipment_sharing',
			checked: 'true'
		},
		{ name: 'Event Types', value: 'event_types', checked: 'true' },
		{ name: 'Expense', value: 'expense', checked: 'true' },
		{
			name: 'Expense Category',
			value: 'expense_category',
			checked: 'true'
		},
		{ name: 'Goal', value: 'goal', checked: 'true' },
		{ name: 'Goal Kpi', value: 'goal_kpi', checked: 'true' },
		{ name: 'Goal Time Frame', value: 'goal_time_frame', checked: 'true' },
		{ name: 'Knowlwdge Base', value: 'knowledge_base', checked: 'true' },
		{
			name: 'Knowledge Base Article',
			value: 'knowledge_base_article',
			checked: 'true'
		},
		{
			name: 'Knowledge Base Author',
			value: 'knowledge_base_author',
			checked: 'true'
		},
		{ name: 'Income', value: 'income', checked: 'true' },
		{ name: 'Integration', value: 'integration', checked: 'true' },
		{
			name: 'Integration Entity Setting',
			value: 'integration_entity_setting',
			checked: 'true'
		},
		{
			name: 'Integration Entity Setting Tied Entity',
			value: 'integration_entity_setting_tied_entity',
			checked: 'true'
		},
		{ name: 'Integration Map', value: 'integration_map', checked: 'true' },
		{
			name: 'Integration Setting',
			value: 'integration_setting',
			checked: 'true'
		},
		{
			name: 'Integration Tenant',
			value: 'integration_tenant',
			checked: 'true'
		},
		{ name: 'Invite', value: 'invite', checked: 'true' },
		{ name: 'Invoice', value: 'invoice', checked: 'true' },
		{ name: 'Invoice Item', value: 'invoice_item', checked: 'true' },
		{ name: 'Key Result', value: 'key_result', checked: 'true' },
		{
			name: 'Key Result Update',
			value: 'key_result_update',
			checked: 'true'
		},
		{ name: 'Language', value: 'language', checked: 'true' },
		{
			name: 'Organization Awards',
			value: 'organization_awards',
			checked: 'true'
		},
		{ name: 'Organization', value: 'organization', checked: 'true' },
		{
			name: 'Organization Employee Level',
			value: 'organization_employee_level',
			checked: 'true'
		},
		{
			name: 'Organization Contact',
			value: 'organization_contact',
			checked: 'true'
		},
		{
			name: 'Organization Department',
			value: 'organization_department',
			checked: 'true'
		},
		{
			name: 'Organization Document',
			value: 'organization_document',
			checked: 'true'
		},
		{
			name: 'Organization Language',
			value: 'organization_language',
			checked: 'true'
		},
		{
			name: 'Organization Employment Type',
			value: 'organization_employment_type',
			checked: 'true'
		},
		{
			name: 'Organization Position',
			value: 'organization_position',
			checked: 'true'
		},
		{
			name: 'Organization Project',
			value: 'organization_project',
			checked: 'true'
		},
		{
			name: 'Organization Recurring Expense',
			value: 'organization_recurring_expense',
			checked: 'true'
		},
		{
			name: 'Organization Sprint',
			value: 'organization_sprint',
			checked: 'true'
		},
		{
			name: 'Organization Team Employee',
			value: 'organization_team_employee',
			checked: 'true'
		},
		{
			name: 'Organization Team',
			value: 'organization_team',
			checked: 'true'
		},
		{
			name: 'Organization Vendor',
			value: 'organization_vendor',
			checked: 'true'
		},
		{ name: 'Payment', value: 'payment', checked: 'true' },
		{ name: 'Pipeline', value: 'pipeline', checked: 'true' },
		{ name: 'Product', value: 'product', checked: 'true' },
		{
			name: 'Product Category',
			value: 'product_category',
			checked: 'true'
		},
		{ name: 'Product Option', value: 'product_option', checked: 'true' },
		{
			name: 'Product Settings',
			value: 'product_settings',
			checked: 'true'
		},
		{ name: 'Product Type', value: 'product_type', checked: 'true' },
		{ name: 'Product Variant', value: 'product_variant', checked: 'true' },
		{
			name: 'Product Variant Price',
			value: 'product_variant_price',
			checked: 'true'
		},
		{ name: 'Proposal', value: 'proposal', checked: 'true' },
		{
			name: 'Request Approval',
			value: 'request_approval',
			checked: 'true'
		},
		{ name: 'Role', value: 'role', checked: 'true' },
		{ name: 'Role Permissiom', value: 'role_permission', checked: 'true' },
		{ name: 'Screenshot', value: 'screenshot', checked: 'true' },
		{ name: 'Skill', value: 'skill', checked: 'true' },
		{ name: 'Stage', value: 'stage', checked: 'true' },
		{ name: 'Tag', value: 'tag', checked: 'true' },
		{ name: 'Task', value: 'task', checked: 'true' },
		{ name: 'Tenant', value: 'tenant', checked: 'true' },
		{ name: 'Time off Policy', value: 'time-off-policy', checked: 'true' },
		{
			name: 'Time Off Request',
			value: 'time-off-request',
			checked: 'true'
		},
		{ name: 'Time Sheet', value: 'timesheet', checked: 'true' },
		{ name: 'Time Log', value: 'time_log', checked: 'true' },
		{ name: 'Time Slot', value: 'time_slot', checked: 'true' },
		{ name: 'User', value: 'users', checked: 'true' },
		{
			name: 'User Organization',
			value: 'user_organization',
			checked: 'true'
		}
	];

	constructor(private exportAll: ExportAllService, private router: Router) {}

	ngOnInit() {
		this.checkbox();
	}

	checkbox() {
		this.form = new FormGroup({
			checkboxes: this.checkboxEvent(this.files)
		});
		this.onCheckboxChange();
	}

	checkboxEvent(checkboxesInputs) {
		const cb = checkboxesInputs.map((checkbox) => {
			return new FormControl(checkbox.checked || false);
		});
		return new FormArray(cb);
	}

	onCheckboxChange() {
		this.selectedfiles = _.map(
			this.form.controls.checkboxes['controls'],
			(checkbox, i) => {
				return checkbox.value && this.files[i].value;
			}
		);
		this.selectedCheckboxes();
	}

	getControls() {
		return (this.form.get('checkboxes') as FormArray).controls;
	}

	selectedCheckboxes() {
		this.selectedfiles = _.filter(this.selectedfiles, (checkbox) => {
			if (checkbox !== false) {
				return checkbox;
			}
		});
	}

	onSubmit() {
		console.log('Exported Files', this.selectedfiles);
		this.exportAll
			.downloadSpecificData(this.selectedfiles)
			.subscribe((data) => saveAs(data, `export.zip`));
	}

	onDownloadAll() {
		this.exportAll
			.downloadAllData()
			.subscribe((data) => saveAs(data, `export.zip`));
	}

	onDownloadTemplates() {
		this.exportAll
			.downloadTemplates()
			.subscribe((data) => saveAs(data, `template.zip`));
	}

	importPage() {
		this.router.navigate(['/pages/settings/import-export/import']);
	}

	ngOnDestroy() {}
}
