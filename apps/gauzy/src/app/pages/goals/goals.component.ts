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
import { KeyresultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { GoalService } from '../../@core/services/goal.service';

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
	employee: SelectedEmployee;
	employeeId: string;
	private _ngDestroy$ = new Subject<void>();
	goals: Goals[];
	constructor(
		private store: Store,
		private translate: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private goalService: GoalService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.goals = this.goalService.getAll();
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
			context: {
				data: keyResult
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			if (!!keyResult) {
				// Update Key Result
				const keyResultIndex = this.goals[index].keyResults.findIndex(
					(element) => element.name === keyResult.name
				);
				this.goals[index].keyResults[keyResultIndex] = response;
				const keyResNumber = this.goals[index].keyResults.length * 100;
				this.goals[index].progress = this.calculateGoalProgress(
					keyResNumber,
					this.goals[index].keyResults
				);
				this.toastrService.primary('key result Updated', 'Success');
			} else {
				// Add Key Result
				this.goals[index].keyResults.push(response);
				this.toastrService.primary('key result added', 'Success');
			}
			this.loadPage();
		}
	}

	calculateGoalProgress(totalCount, keyResults) {
		console.table(keyResults);
		const progressTotal = keyResults.reduce((a, b) => a + b.progress, 0);
		console.log((progressTotal / totalCount) * 100);
		return (progressTotal / totalCount) * 100;
	}

	async createObjective(goal, index) {
		const dialog = this.dialogService.open(EditObjectiveComponent, {
			hasScroll: true,
			context: {
				data: goal
			}
		});

		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			if (!!goal) {
				// Update Goal
				this.goals[index].name = response.name;
				this.goals[index].description = response.description;
				this.goals[index].deadline = response.deadline;
				this.goals[index].owner = response.owner;
				this.goals[index].lead = response.lead;
				this.toastrService.primary('Objective updated', 'Success');
			} else {
				this.goals.push({
					...response,
					type: 'organization',
					organizationId: this.selectedOrganizationId,
					keyResults: []
				});
				this.toastrService.primary('Objective added', 'Success');
			}
			this.loadPage();
		}
	}

	async openGoalDetials(data) {
		const dialog = this.dialogService.open(GoalDetailsComponent, {
			hasScroll: true,
			context: {
				goal: data
			}
		});
	}

	async keyResultUpdate(index, selectedkeyResult) {
		const keyResultDialog = this.dialogService.open(
			KeyresultUpdateComponent,
			{
				hasScroll: true,
				context: {
					keyResult: selectedkeyResult
				}
			}
		);
		const response = await keyResultDialog.onClose
			.pipe(first())
			.toPromise();
		if (!!response) {
			const keyResultIndex = this.goals[index].keyResults.findIndex(
				(element) => element.name === selectedkeyResult.name
			);
			this.goals[index].keyResults[keyResultIndex] = response;
			const keyResNumber = this.goals[index].keyResults.length * 100;
			this.goals[index].progress = this.calculateGoalProgress(
				keyResNumber,
				this.goals[index].keyResults
			);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
