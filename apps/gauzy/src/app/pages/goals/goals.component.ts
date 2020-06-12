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
import { Goals, KeyResult } from '@gauzy/models';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { KeyresultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { GoalService } from '../../@core/services/goal.service';
import { KeyresultService } from '../../@core/services/keyresult.service';

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
	noGoals = true;
	keyResult: KeyResult[];
	constructor(
		private store: Store,
		private translate: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private goalService: GoalService,
		private keyResultService: KeyresultService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.goalService
			.getAllGoals()
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((goals) => {
				if (goals.items.length > 0) {
					this.noGoals = false;
				}
				this.goals = goals.items;
				this.goals.forEach(async (goal, index) => {
					await this.keyResultService
						.getAllKeyResults(goal.id)
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((val) => {
							if (!!val.items) {
								this.goals[index].keyResults = val.items;
							}
						});
				});
			});

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
			const data = {
				...response,
				goalId: this.goals[index].id
			};
			this.keyResultService.createKeyResult(data);
			this.toastrService.primary('key result added', 'Success');
			this.loadPage();
		}
	}

	calculateGoalProgress(totalCount, keyResults) {
		console.table(keyResults);
		const progressTotal = keyResults.reduce((a, b) => a + b.progress, 0);
		console.log((progressTotal / totalCount) * 100);
		return Math.round((progressTotal / totalCount) * 100);
	}

	async createObjective(goal, index) {
		console.log(goal);
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
				this.goalService.update(goal.id, this.goals[index]);
				this.toastrService.primary('Objective updated', 'Success');
			} else {
				this.goals.push({
					...response,
					type: 'organization',
					organizationId: this.selectedOrganizationId,
					progress: 0
				});
				const data = {
					...response,
					type: 'organization',
					organizationId: this.selectedOrganizationId,
					progress: 0
				};
				console.table(data);
				await this.goalService.createGoal(data);
				this.toastrService.primary('Objective added', 'Success');
			}
			await this.goalService.getAllGoals();
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
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			await this.goalService.update(response.id, response);
			this.toastrService.primary('Goal updated', 'Success');
			this.loadPage();
		}
	}

	async keyResultUpdate(index, selectedkeyResult: KeyResult) {
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
			await this.keyResultService.update(selectedkeyResult.id, response);
			const keyResNumber = this.goals[index].keyResults.length * 100;
			this.goals[index].progress = this.calculateGoalProgress(
				keyResNumber,
				this.goals[index].keyResults
			);
			this.goalService.update(this.goals[index].id, this.goals[index]);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
