import { ChangeDetectionStrategy, Component, forwardRef, OnInit } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganizationTeam } from 'packages/contracts/dist';
import { combineLatest, concatMap, filter, map, Observable, of, tap } from 'rxjs';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { AbstractSelectorComponent } from '../../components/abstract/selector.abstract';
import { SelectorElectronService } from '../../services/selector-electron.service';
import { ProjectSelectorService } from '../project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorQuery } from './+state/team-selector.query';
import { TeamSelectorService } from './+state/team-selector.service';
import { TeamSelectorStore } from './+state/team-selector.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-team-selector',
	templateUrl: './team-selector.component.html',
	styleUrls: ['./team-selector.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TeamSelectorComponent),
			multi: true
		}
	]
})
export class TeamSelectorComponent extends AbstractSelectorComponent<IOrganizationTeam> implements OnInit {
	constructor(
		private readonly selectorElectronService: SelectorElectronService,
		private readonly teamSelectorStore: TeamSelectorStore,
		private readonly teamSelectorQuery: TeamSelectorQuery,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly teamSelectorService: TeamSelectorService
	) {
		super();
	}
	public ngOnInit(): void {
		this.taskSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
		this.teamSelectorQuery.selected$
			.pipe(
				filter(Boolean),
				tap(() => this.projectSelectorService.resetPage()),
				concatMap(() => this.projectSelectorService.load()),
				untilDestroyed(this)
			)
			.subscribe();
		// Handle search logic
		this.handleSearch(this.projectSelectorService);
	}

	public clear(): void {
		this.selectorElectronService.update({ organizationTeamId: null });
		this.selectorElectronService.refresh();
	}

	public get error$(): Observable<string> {
		return this.teamSelectorQuery.selectError();
	}

	public get selected$(): Observable<IOrganizationTeam> {
		return this.teamSelectorQuery.selected$;
	}

	public get data$(): Observable<IOrganizationTeam[]> {
		return this.teamSelectorQuery.data$;
	}

	protected updateSelected(value: IOrganizationTeam['id']): void {
		// Update store only if useStore is true
		if (this.useStore) {
			this.selectorElectronService.update({ organizationTeamId: value });
			this.teamSelectorStore.updateSelected(value);
		}
	}

	public get isLoading$(): Observable<boolean> {
		return this.teamSelectorQuery.selectLoading();
	}

	public get disabled$(): Observable<boolean> {
		return combineLatest([this.timeTrackerQuery.disabled$, this.isDisabled$.asObservable()]).pipe(
			map(([disabled, selectorDisabled]) => disabled || selectorDisabled)
		);
	}

	public get hasPermission$(): Observable<boolean> {
		return of(false);
	}

	public onShowMore(): void {
		this.teamSelectorService.onScrollToEnd();
	}
}
