import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { filter, debounceTime, withLatestFrom, tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { NbDialogService, NbPopoverDirective } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IEmployee,
	IGoal,
	IKeyResult,
	IGoalGeneralSetting,
	IOrganization,
	ISelectedEmployee,
	IUser,
	GoalLevelEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/core';
import {
	ErrorHandlingService,
	GoalService,
	GoalSettingsService,
	KeyResultService,
	ToastrService
} from '@gauzy/ui-core/core';
import { AlertModalComponent } from '@gauzy/ui-core/shared';
import { EditObjectiveComponent } from './edit-objective/edit-objective.component';
import { EditKeyResultsComponent } from './edit-keyresults/edit-keyresults.component';
import { KeyResultUpdateComponent } from './keyresult-update/keyresult-update.component';
import { KeyResultDetailsComponent } from './keyresult-details/keyresult-details.component';
import { KeyResultParametersComponent } from './key-result-parameters/key-result-parameters.component';
import { GoalTemplateSelectComponent } from './goal-template-select/goal-template-select.component';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbProgressBarModule,
	NbTooltipModule,
	NbPopoverModule,
	NbListModule
} from '@nebular/theme';
import { SharedModule } from '@gauzy/ui-core/shared';
import { GoalsComponentsModule } from './goals-components.module';

/** The key-result statuses the list knows how to show (`KEY_RESULT_PAGE.UPDATE.STATUS.*`). */
const KEY_RESULT_STATUS_KEYS = ['ON_TRACK', 'NEEDS_ATTENTION', 'OFF_TRACK', 'NONE'];

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-goals',
	templateUrl: './goals.component.html',
	styleUrls: ['./goals.component.scss'],
	standalone: true,
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [
		GoalsComponentsModule,
		CommonModule,
		TranslatePipe,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbProgressBarModule,
		NbTooltipModule,
		// `[nbPopover]` drives the Add Objective / Group By / Filter menus, whose bodies are `nb-list`s.
		NbPopoverModule,
		NbListModule,
		SharedModule
	]
})
export class GoalsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	/** Every menu on the page: a pick in one closes it before its dialog opens. */
	@ViewChildren(NbPopoverDirective) popovers: QueryList<NbPopoverDirective>;
	loading = true;
	selectedOrganizationId: string;
	organizationName: string;
	employee: ISelectedEmployee;
	isEmployee = false;
	selectedFilter = 'all';
	objectiveGroup = 'timeFrames';
	goalGeneralSettings: IGoalGeneralSetting;
	goalTimeFrames: Array<string> = [];
	filters = [
		{
			title: this.getTranslation('GOALS_PAGE.ALL_OBJECTIVES'),
			value: 'all'
		},
		{
			title: this.getTranslation('GOALS_PAGE.MY_TEAMS_OBJECTIVES'),
			value: 'team'
		},
		{
			title: this.getTranslation('GOALS_PAGE.MY_ORGANIZATIONS_OBJECTIVES'),
			value: 'organization'
		},
		{
			title: this.getTranslation('GOALS_PAGE.MY_OBJECTIVES'),
			value: 'employee'
		}
	];
	goalLevels = [...Object.values(GoalLevelEnum)];
	groupObjectivesBy = [
		{
			title: this.getTranslation('GOALS_PAGE.OBJECTIVE_LEVEL'),
			value: 'level'
		},
		{
			title: this.getTranslation('GOALS_PAGE.TIME_FRAME'),
			value: 'timeFrames'
		}
	];
	/** The objectives the Filter menu lets through. */
	goals: IGoal[] = [];
	allGoals: IGoal[] = [];
	/** `goals` narrowed by the search box: what the list shows. */
	visibleGoals: IGoal[] = [];
	noGoals = true;
	organization: IOrganization;

	/** The search box's text, matched against objective and key-result names. */
	searchQuery = '';
	/** Objectives whose key results are shown under them. */
	readonly expandedGoalIds = new Set<string>();
	/** The objective whose details are open beside the list, if any. */
	detailGoalId: string | null = null;

	constructor(
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly goalService: GoalService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly keyResultService: KeyResultService,
		private readonly goalSettingsService: GoalSettingsService
	) {
		super(translateService);
	}

	get activeGroups() {
		return this.objectiveGroup === 'timeFrames' ? this.goalTimeFrames : this.goalLevels;
	}

	get selectedFilterTitle(): string {
		return this.filters.find((option) => option.value === this.selectedFilter)?.title ?? '';
	}

	get selectedGroupTitle(): string {
		return this.groupObjectivesBy.find((option) => option.value === this.objectiveGroup)?.title ?? '';
	}

	/**
	 * The objective open in the side column, read from the latest load: after every re-read the column is
	 * handed the fresh object, so its key results, progress and updates follow the list.
	 */
	get detailGoal(): IGoal | null {
		return this.detailGoalId ? this.allGoals.find((goal) => goal.id === this.detailGoalId) ?? null : null;
	}

	goalsForGroup(group: string): IGoal[] {
		return this.visibleGoals.filter((goal) =>
			this.objectiveGroup === 'timeFrames' ? goal.deadline === group : goal.level === group
		);
	}

	/** A group's heading: the time frame's own name, or the translated level. */
	groupTitle(group: string): string {
		return this.objectiveGroup === 'level' ? this.levelTitle(group) : group;
	}

	levelTitle(level: string): string {
		return level ? this.getTranslation(`GOALS_PAGE.LEVELS.${level.toUpperCase()}`) : '';
	}

	/** Who owns the objective: its employee, else its team, else its organization. */
	goalOwnerName(goal: IGoal): string {
		return goal.ownerEmployee?.user?.name || goal.ownerTeam?.name || goal.organization?.name || '';
	}

	employeeName(employee?: IEmployee): string {
		return employee?.user?.name || employee?.fullName || '';
	}

	/** A key result's status as its `KEY_RESULT_PAGE.UPDATE.STATUS` key; one never reported reads as None. */
	statusKey(status?: string): string {
		const key = (status || 'none').trim().toUpperCase().replace(/\s+/g, '_');
		return KEY_RESULT_STATUS_KEYS.includes(key) ? key : 'NONE';
	}

	isExpanded(goal: IGoal): boolean {
		return this.expandedGoalIds.has(goal.id);
	}

	/** The row's chevron: shows or hides its key results without opening the objective's details. */
	toggleExpanded(goal: IGoal, event?: Event) {
		event?.stopPropagation();
		if (this.expandedGoalIds.has(goal.id)) {
			this.expandedGoalIds.delete(goal.id);
		} else {
			this.expandedGoalIds.add(goal.id);
		}
	}

	onSearch(query: string) {
		this.searchQuery = query ?? '';
		this.applySearch();
	}

	/**
	 * Narrows the filtered objectives to those whose name, or one of whose key results' names, holds the search
	 * text. An objective found through a key result is expanded, so the match is on screen.
	 */
	private applySearch() {
		const query = this.searchQuery.trim().toLowerCase();
		if (!query) {
			this.visibleGoals = this.goals;
			return;
		}
		const matches = (name?: string) => !!name && name.toLowerCase().includes(query);
		this.visibleGoals = this.goals.filter((goal) => {
			const keyResultMatch = (goal.keyResults ?? []).some((keyResult) => matches(keyResult.name));
			if (keyResultMatch) {
				this.expandedGoalIds.add(goal.id);
			}
			return matches(goal.name) || keyResultMatch;
		});
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.isEmployee = !!user.employee)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((employee) => !!employee),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee.id && this.organization) {
					this.employee = employee;
					this.loadPage();
				}
			});
		storeOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				this.employee = employee || null;
				if (organization) {
					// Another organization's objectives: whatever was open belonged to the last one.
					if (this.organization && this.organization.id !== organization.id) {
						this.detailGoalId = null;
						this.expandedGoalIds.clear();
					}
					this.organization = organization;
					this.organizationName = organization.name;
					this.selectedOrganizationId = organization.id;
					this.loadPage();
				}
			});
	}

	async getGoalSettings(findObj) {
		await this.goalSettingsService.getAllGeneralSettings(findObj).then((res) => {
			const { items } = res;
			this.goalGeneralSettings = items.pop();
		});
	}

	private async loadPage() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		try {
			const { tenantId } = this.store.user;
			const findObj = {
				organizationId: this.selectedOrganizationId,
				tenantId
			};
			await this.getGoalSettings(findObj);
			await this.goalService
				.getAllGoals(
					[
						'keyResults',
						'keyResults.updates',
						'keyResults.goal',
						'ownerEmployee',
						'ownerEmployee.user',
						'organization',
						'ownerTeam',
						'lead',
						'lead.user',
						'keyResults.owner',
						// The list names each key result's owner and lead.
						'keyResults.owner.user',
						'keyResults.lead',
						'keyResults.lead.user',
						'alignedKeyResult',
						'alignedKeyResult.goal',
						'alignedKeyResult.goal.ownerEmployee',
						'alignedKeyResult.goal.ownerEmployee.user',
						'alignedKeyResult.goal.organization',
						'alignedKeyResult.goal.ownerTeam',
						'alignedKeyResult.owner',
						'alignedKeyResult.lead',
						'alignedKeyResult.updates'
					],
					findObj
				)
				.then((goals) => {
					if (goals) {
						this.noGoals = goals.items.length > 0 ? false : true;
						this.goals = goals.items;
						this.allGoals = goals.items;
						// The open objective was deleted elsewhere: close its column rather than show a stale copy.
						if (this.detailGoalId && !this.allGoals.some((goal) => goal.id === this.detailGoalId)) {
							this.detailGoalId = null;
						}
						if (!!this.selectedFilter) {
							this.filterGoals(this.selectedFilter, this.allGoals);
						} else {
							this.applySearch();
						}
					}
				});
		} catch (error) {
			console.error('Error while retrieving goals', error);
			this.toastrService.danger(error);
		} finally {
			this.loading = false;
		}
	}

	/** Closes whichever menu is open, before the dialog its item opens. */
	private hidePopovers() {
		this.popovers?.forEach((popover) => {
			if (popover.isShown) {
				popover.hide();
			}
		});
	}

	async openKeyResultParameters(goal: IGoal, keyResult: IKeyResult) {
		const dialog = this.dialogService.open(KeyResultParametersComponent, {
			context: {
				data: {
					selectedKeyResult: keyResult,
					allKeyResults: goal.keyResults,
					settings: this.goalGeneralSettings,
					orgId: this.selectedOrganizationId
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			this.toastrService.success('TOASTR.MESSAGE.KEY_RESULT_UPDATED');
			this.loadPage();
		}
	}

	createGroups(goals) {
		this.goalTimeFrames = [];
		goals.forEach((goal) => {
			if (this.goalTimeFrames.length < 1) {
				this.goalTimeFrames.push(goal.deadline);
			} else if (this.goalTimeFrames.findIndex((element) => element === goal.deadline) === -1) {
				this.goalTimeFrames.push(goal.deadline);
			}
		});
		this.goalLevels = this.goalLevels.filter((goalLevel) => goals.find((goal) => goal.level === goalLevel));
		this.goalTimeFrames.sort((a, b) => a.localeCompare(b));
	}

	/**
	 * Adds a key result to the objective, or edits `keyResult` when one is given.
	 */
	async addKeyResult(goal: IGoal, keyResult?: IKeyResult) {
		if (!keyResult && this.goalGeneralSettings?.maxKeyResults <= (goal.keyResults?.length ?? 0)) {
			this.toastrService.info(
				this.getTranslation('TOASTR.MESSAGE.MAX_KEY_RESULT_LIMIT'),
				this.getTranslation('TOASTR.TITLE.MAX_LIMIT_REACHED'),
				{ duration: 5000, preventDuplicates: true }
			);
			return;
		}
		const dialog = this.dialogService.open(EditKeyResultsComponent, {
			hasScroll: true,
			context: {
				data: keyResult ?? null,
				orgId: this.selectedOrganizationId,
				orgName: this.organizationName,
				goalDeadline: goal.deadline,
				settings: this.goalGeneralSettings
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (response) {
			if (!!keyResult) {
				// The objective is written without its key results, which `PUT /goals/:id` does not take.
				const { keyResults, ...goalData } = goal;
				goalData.progress = this.calculateGoalProgress(keyResults ?? []);
				await this.goalService.update(goal.id, goalData as IGoal);
				const keyResultData = response;
				delete keyResultData.goal;
				delete keyResultData.updates;
				await this.keyResultService.update(keyResult.id, keyResultData).then((val) => {
					if (val) {
						this.toastrService.success(this.getTranslation('TOASTR.MESSAGE.KEY_RESULT_UPDATED'));
						this.loadPage();
					}
				});
			} else {
				const data = {
					...response,
					ownerId: response.ownerId,
					leadId: response.leadId,
					goalId: goal.id
				};
				await this.keyResultService.createKeyResult(data).then((val) => {
					if (val) {
						// Shown under its objective once the list re-reads.
						this.expandedGoalIds.add(goal.id);
						this.toastrService.success('TOASTR.MESSAGE.KEY_RESULT_ADDED');
						this.loadPage();
					}
				});
			}
		}
	}

	groupBy(group) {
		this.objectiveGroup = group;
		this.hidePopovers();
	}

	calculateGoalProgress(keyResults) {
		const progressTotal = keyResults.reduce((a, b) => a + b.progress * +b.weight, 0);
		const weightTotal = keyResults.reduce((a, b) => a + +b.weight, 0);
		return Math.round(progressTotal / weightTotal);
	}

	filterGoals(selection, allGoals) {
		this.hidePopovers();
		this.selectedFilter = selection;
		if (selection !== 'all') {
			if (selection === 'employee' && !!this.employee) {
				this.goals = allGoals.filter((goal) =>
					this.employee.id == null
						? goal.level?.toLowerCase() === selection
						: goal.ownerEmployee?.id === this.employee.id
				);
			} else {
				this.goals = allGoals.filter((goal) => goal.level?.toLowerCase() === selection);
			}
			this.goalLevels = [GoalLevelEnum[selection.toUpperCase()]];
		} else {
			this.goals = allGoals;
			this.goalLevels = [...Object.values(GoalLevelEnum)];
			this.goalLevels = this.goalLevels.filter((goalLevel) =>
				this.goals.find((goal) => goal.level === goalLevel)
			);
		}
		this.noGoals = this.goals.length > 0 ? false : true;
		if (this.goals.length > 0) {
			this.createGroups(this.goals);
		} else {
			this.goalLevels = [];
			this.goalTimeFrames = [];
		}
		this.applySearch();
	}

	async createObjectiveFromTemplate() {
		this.hidePopovers();
		const dialog = this.dialogService.open(GoalTemplateSelectComponent, {
			context: {
				orgId: this.selectedOrganizationId,
				orgName: this.organizationName
			}
		});
		const response = await firstValueFrom(dialog.onClose);
		if (response) {
			this.loadPage();
		}
	}

	/**
	 * Creates an objective ("Create New" in the Add Objective menu), or edits `goal` when one is given (a row's
	 * Edit).
	 */
	async createObjective(goal?: IGoal) {
		// Close the menu as "Create from Preset" does, or it stays open behind the dialog.
		this.hidePopovers();
		if (!goal && this.goalGeneralSettings && this.goalGeneralSettings.maxObjectives <= this.allGoals.length) {
			this.toastrService.info(
				this.getTranslation('TOASTR.MESSAGE.MAX_OBJECTIVE_LIMIT'),
				this.getTranslation('TOASTR.TITLE.MAX_LIMIT_REACHED'),
				{ duration: 5000, preventDuplicates: true }
			);
			return;
		}
		const dialog = this.dialogService.open(EditObjectiveComponent, {
			hasScroll: true,
			context: {
				data: goal ?? null,
				orgId: this.selectedOrganizationId,
				orgName: this.organizationName,
				settings: this.goalGeneralSettings
			},
			closeOnBackdropClick: false
		});

		const response = await firstValueFrom(dialog.onClose);
		if (response) {
			if (!!goal) {
				// Update Goal
				await this.goalService.update(goal.id, response).then((res) => {
					if (res) {
						this.toastrService.success(this.getTranslation('TOASTR.MESSAGE.OBJECTIVE_UPDATED'));
						this.loadPage();
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
					await this.goalService.createGoal(data).then(() => {
						this.toastrService.success(this.getTranslation('TOASTR.MESSAGE.OBJECTIVE_ADDED'));
						this.loadPage();
					});
				} catch (error) {
					this.errorHandler.handleError(error);
				}
			}
		}
	}

	/** Opens the objective's details in the column beside the list. */
	openGoalDetails(goal: IGoal) {
		this.detailGoalId = goal.id;
	}

	closeGoalDetails() {
		this.detailGoalId = null;
	}

	/** The details column deleted its objective, or changed one of its key results: the list re-reads. */
	onGoalDetailsChanged(change: 'deleted' | 'updated') {
		if (change === 'deleted') {
			this.detailGoalId = null;
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.OBJECTIVE_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.loadPage();
	}

	async openKeyResultDetails(keyResult: IKeyResult) {
		const dialog = this.dialogService.open(KeyResultDetailsComponent, {
			hasScroll: true,
			context: {
				keyResult
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'deleted') {
				this.toastrService.danger(
					this.getTranslation('TOASTR.MESSAGE.KEY_RESULT_DELETED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this.loadPage();
			} else {
				// A progress update filed in the details moved the key result and its goal on the server (owner
				// decision 2(a), 2026-10-23); writing the goal back with `PUT /goals/:id` needs `GOALS_EDIT` and
				// refused an employee reporting their own key result. The page re-reads instead.
				this.toastrService.success('TOASTR.MESSAGE.KEY_RESULT_UPDATED');
				this.loadPage();
			}
		}
	}

	calculateKeyResultWeight(weight, goal) {
		const weightSum = goal.keyResults.reduce((a, b) => a + +b.weight, 0);
		return Math.round(+weight * (100 / weightSum));
	}

	async keyResultUpdate(index, selectedKeyResult: IKeyResult) {
		const keyResultDialog = this.dialogService.open(KeyResultUpdateComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedKeyResult
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(keyResultDialog.onClose);
		if (!!response) {
			// The dialog filed the update and the server applied it to the key result and its goal, so neither is
			// written back here (`PUT /key-results/:id` and `PUT /goals/:id` need `GOALS_EDIT`).
			this.toastrService.success('TOASTR.MESSAGE.KEY_RESULT_UPDATED');
			this.loadPage();
		}
	}

	async deleteKeyResult(keyResult: IKeyResult) {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				data: {
					title: this.getTranslation('GOALS_PAGE.DELETE_KEY_RESULT'),
					message: this.getTranslation('GOALS_PAGE.ARE_YOU_SURE'),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (response === 'yes') {
			await this.keyResultService
				.delete(keyResult.id)
				.then(() => this.loadPage())
				.catch((error) => console.log(error));
		}
	}

	async deleteGoal(goal: IGoal) {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				data: {
					title: this.getTranslation('GOALS_PAGE.DELETE_OBJECTIVE'),
					message: this.getTranslation('GOALS_PAGE.ARE_YOU_SURE'),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (response === 'yes') {
			await this.goalService
				.delete(goal.id)
				.then(() => {
					if (this.detailGoalId === goal.id) {
						this.detailGoalId = null;
					}
					this.expandedGoalIds.delete(goal.id);
					return this.loadPage();
				})
				.catch((error) => console.log(error));
		}
	}

	ngOnDestroy() {}
}
