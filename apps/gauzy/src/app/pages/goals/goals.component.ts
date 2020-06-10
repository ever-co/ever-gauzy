import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyresultsComponent } from './edit-keyresults/edit-keyresults.component';
import { GoalDetailsComponent } from './goal-details/goal-details.component';
import { Goals } from '@gauzy/models';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ga-goals',
	templateUrl: './goals.component.html',
	styleUrls: ['./goals.component.scss']
})
export class GoalsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	loading = true;
	selectedOrganizationId: string;
	organizationName: string;
	employee:SelectedEmployee;
	employeeId: string;
	private _ngDestroy$ = new Subject<void>();
	goals:Goals[] = [
		{
			name: "Improve User Retention",
			description: '',
			owner: "8bd04bc6-a532-4682-9795-d1886c94dfac",
			lead: "935d03d4-39b4-46c0-8390-a04644d7480c",
			deadline: "Q3-2020",
			type: 'Organization',
			progress: 40,
			organizationId: "eef48c64-b4eb-491b-bcfb-e998fb766d2f",
			keyResults: [
				{
					name: "Establish Cash to Cash Cycle Time",
					description: '',
					type: "Number",
					targetValue: 10,
					initialValue: 5,					
					update: 3,
					progress: 60,
					owner: "8bd04bc6-a532-4682-9795-d1886c94dfac",
					lead: "935d03d4-39b4-46c0-8390-a04644d7480c",
					deadline: "No Custom Deadline",
				},
				{
					name: "Maintain Pageviews per Week by Q2-2020",
					description: '',
					type: "True/False",
					targetValue: null,
					initialValue: null,					
					update: false,
					progress: 0,
					owner: "8bd04bc6-a532-4682-9795-d1886c94dfac",
					lead: "935d03d4-39b4-46c0-8390-a04644d7480c",
					deadline: "Hard deadline",
					hardDeadline: new Date,
				},
			]
		},
		{
			name: "Increase Website Engagement",
			description: '',
			owner: "8bd04bc6-a532-4682-9795-d1886c94dfac",
			lead: "935d03d4-39b4-46c0-8390-a04644d7480c",
			deadline: "Q4-2020",
			progress: 70,
			organizationId: "eef48c64-b4eb-491b-bcfb-e998fb766d2f",
			type: "Organization",
			keyResults: [
				{
					name: "Decrease Bounce Rate by Q2-2020",
					description: '',
					type: "True/False",
					targetValue: null,
					initialValue: null,
					update: false,
					progress:0,
					owner: "8bd04bc6-a532-4682-9795-d1886c94dfac",
					lead: "935d03d4-39b4-46c0-8390-a04644d7480c",
					deadline: "No Custom Deadline",
				},
				{
					name: "Increase Avg. Pages per Visit by Q2-2020",
					description: '',
					type: "Number",
					targetValue: 10,
					initialValue: 5,
					update: 4,
					progress: 80,
					owner: "8bd04bc6-a532-4682-9795-d1886c94dfac",
					lead: "935d03d4-39b4-46c0-8390-a04644d7480c",
					deadline: "Hard deadline",
					hardDeadline: new Date,
				},
			]
		}
	];

	constructor(
		private store: Store,
		private translate: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					this.loadPage();
				}
			});
	}

	private async loadPage() {
		const { name } = this.store.selectedOrganization;
		this.loading = false;
		this.organizationName = name;
	}

	async addKeyResult(index, keyResult) {
		const dialog = this.dialogService.open(EditKeyresultsComponent, {
				hasScroll: true,
				context:{
					data: keyResult
				}
			 });
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			if(!!keyResult){
				// Update Key Result
				const keyResultIndex = this.goals[index].keyResults.findIndex(element => (element.name === keyResult.name));
				this.goals[index].keyResults[keyResultIndex] = response;
				this.toastrService.primary('key result Updated', 'Success');
			}else{
				// Add Key Result
				this.goals[index].keyResults.push(response);
				this.toastrService.primary('key result added', 'Success');
			}		
			this.loadPage();
		}
	}

	async createObjective(goal, index) {
		const dialog = this.dialogService.open(EditObjectiveComponent,{
			hasScroll: true,
			context:{
				data: goal
			}
		});

		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			if(!!goal){
				// Update Goal
				this.goals[index].name = response.name;
				this.goals[index].description = response.description;
				this.goals[index].deadline = response.deadline;
				this.goals[index].owner = response.owner;
				this.goals[index].lead = response.lead;
				this.toastrService.primary('Objective updated', 'Success');
			}else{
				this.goals.push({
					...response,
					type: "organization",
					organizationId: this.selectedOrganizationId,
					keyResults:[]
				})
				this.toastrService.primary('Objective added', 'Success');
			}			
			this.loadPage();
		}
	}

	async openGoalDetials(data) {
		const dialog = this.dialogService.open(GoalDetailsComponent, {
			hasScroll: true,
			context:data
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			this.toastrService.primary('Objective added', 'Success');
			this.loadPage();
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
