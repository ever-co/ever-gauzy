import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {
	NbDialogService,
	NbToastrService,
	NbPopoverDirective
} from '@nebular/theme';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyResultsComponent } from './edit-keyresults/edit-keyresults.component';
import { GoalDetailsComponent } from './goal-details/goal-details.component';
import { Goal, KeyResult } from '@gauzy/models';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { KeyResultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { GoalService } from '../../@core/services/goal.service';
import { KeyResultService } from '../../@core/services/keyresult.service';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { KeyResultDetailsComponent } from './keyresult-details/keyresult-details.component';

@Component({
	selector: 'ga-goals',
	templateUrl: './goals.component.html',
	styleUrls: ['./goals.component.scss']
})
export class GoalsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild(NbPopoverDirective) popover: NbPopoverDirective;
	loading = true;
	selectedOrganizationId: string;
	organizationName: string;
	employee: SelectedEmployee;
	employeeId: string;
	selectedFilter: string;
	filter = [
		{
			title: 'All Objectives',
			value: 'all'
		},
		{
			title: "My Team's Objectives",
			value: 'team'
		},
		{
			title: 'My Organization Objectives',
			value: 'organization'
		},
		{
			title: 'My Objectives',
			value: 'employee'
		}
	];
	private _ngDestroy$ = new Subject<void>();
	goals: Goal[];
	allGoals: Goal[];
	noGoals = true;
	keyResult: KeyResult[];
	constructor(
		private store: Store,
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private goalService: GoalService,
		private errorHandler: ErrorHandlingService,
		private keyResultService: KeyResultService
	) {
		super(translateService);
	}

	async ngOnInit() {
		await this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
				}
			});
		await this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				this.employee = emp;
				this.loadPage();
			});
	}

	private async loadPage() {
		const { name } = this.store.selectedOrganization
			? this.store.selectedOrganization
			: { name: 'new' };
		this.loading = false;
		this.organizationName = name;
		this.goalService.getAllGoals().then((goals) => {
			this.noGoals = goals.items.length > 0 ? false : true;
			this.goals = goals.items;
			this.allGoals = goals.items;
			if (!!this.selectedFilter && this.selectedFilter !== 'all') {
				this.filterGoals(this.selectedFilter);
			}
		});
	}

	async addKeyResult(index, keyResult) {
		const dialog = this.dialogService.open(EditKeyResultsComponent, {
			hasScroll: true,
			context: {
				data: keyResult
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			if (!!keyResult) {
				const keyResultData = response;
				delete keyResultData.goal;
				delete keyResultData.updates;
				await this.keyResultService
					.update(keyResult.id, keyResultData)
					.then((val) => {
						if (val) {
							this.toastrService.primary(
								this.getTranslation(
									'TOASTR.MESSAGE.KEY_RESULT_UPDATED'
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this.loadPage();
						}
					});
			} else {
				const data = {
					...response,
					goalId: this.goals[index].id
				};
				await this.keyResultService
					.createKeyResult(data)
					.then((val) => {
						if (val) {
							this.toastrService.primary(
								this.getTranslation(
									'TOASTR.MESSAGE.KEY_RESULT_ADDED'
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this.loadPage();
						}
					});
			}
		}
	}

	calculateGoalProgress(totalCount, keyResults) {
		const progressTotal = keyResults.reduce((a, b) => a + b.progress, 0);
		return Math.round((progressTotal / totalCount) * 100);
	}

	filterGoals(selection) {
		this.selectedFilter = selection;
		if (selection !== 'all') {
			if (selection === 'employee' && !!this.employee) {
				this.goals = this.allGoals.filter((goal) =>
					this.employee.id == null
						? goal.level.toLowerCase() === selection
						: goal.owner === this.employee.id
				);
			} else {
				this.goals = this.allGoals.filter(
					(goal) => goal.level.toLowerCase() === selection
				);
			}
		} else {
			this.goals = this.allGoals;
		}
		this.noGoals = this.goals.length > 0 ? false : true;
		this.popover.hide();
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
				await this.goalService.update(goal.id, response).then((res) => {
					if (res) {
						this.toastrService.primary(
							this.getTranslation(
								'TOASTR.MESSAGE.OBJECTIVE_UPDATED'
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
					}
				});
			} else {
				// Add Goal
				const data = {
					...response,
					organizationId: this.selectedOrganizationId,
					progress: 0
				};
				try {
					await this.goalService
						.createGoal(data)
						.then(async (val) => {
							await this.goalService.getAllGoals();
							this.toastrService.primary(
								this.getTranslation(
									'TOASTR.MESSAGE.OBJECTIVE_ADDED'
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
						});
				} catch (error) {
					this.errorHandler.handleError(error);
				}
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
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'deleted') {
				this.toastrService.danger(
					this.getTranslation('TOASTR.MESSAGE.OBJECTIVE_DELETED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this.loadPage();
			} else {
				const goalData = response;
				delete goalData.keyResults;
				await this.goalService
					.update(response.id, goalData)
					.then((res) => {
						if (res) {
							this.toastrService.primary(
								this.getTranslation(
									'TOASTR.MESSAGE.OBJECTIVE_UPDATED'
								),
								this.getTranslation('TOASTR.TITLE.SUCCESS')
							);
							this.loadPage();
						}
					});
			}
		}
	}

	async openKeyResultDetails(index, selectedkeyResult) {
		const dialog = this.dialogService.open(KeyResultDetailsComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedkeyResult,
				owner: this.goals[index].owner
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'deleted') {
				this.toastrService.danger(
					this.getTranslation('TOASTR.MESSAGE.KEY_RESULT_DELETED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this.loadPage();
			} else {
				const keyResNumber = this.goals[index].keyResults.length * 100;
				this.goals[index].progress = this.calculateGoalProgress(
					keyResNumber,
					this.goals[index].keyResults
				);
				const goalData = this.goals[index];
				delete goalData.keyResults;
				await this.goalService.update(this.goals[index].id, goalData);
				this.toastrService.primary(
					this.getTranslation('TOASTR.MESSAGE.KEY_RESULT_UPDATED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this.loadPage();
			}
		}
	}

	async keyResultUpdate(index, selectedKeyResult: KeyResult) {
		const keyResultDialog = this.dialogService.open(
			KeyResultUpdateComponent,
			{
				hasScroll: true,
				context: {
					keyResult: selectedKeyResult
				}
			}
		);
		const response = await keyResultDialog.onClose
			.pipe(first())
			.toPromise();
		if (!!response) {
			const keyResultData = response;
			delete keyResultData.goal;
			delete keyResultData.updates;
			await this.keyResultService.update(
				selectedKeyResult.id,
				keyResultData
			);
			const keyResNumber = this.goals[index].keyResults.length * 100;
			this.goals[index].progress = this.calculateGoalProgress(
				keyResNumber,
				this.goals[index].keyResults
			);
			await this.goalService.update(
				this.goals[index].id,
				this.goals[index]
			);
			this.toastrService.primary(
				this.getTranslation('TOASTR.MESSAGE.KEY_RESULT_UPDATED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.loadPage();
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
