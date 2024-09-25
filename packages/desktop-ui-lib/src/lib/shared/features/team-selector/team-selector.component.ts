import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganizationTeam } from 'packages/contracts/dist';
import { concatMap, debounceTime, distinctUntilChanged, filter, Observable, Subject, switchMap, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
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
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamSelectorComponent implements OnInit {
	public search$ = new Subject<string>();

	constructor(
		private readonly electronService: ElectronService,
		private readonly teamSelectorStore: TeamSelectorStore,
		private readonly teamSelectorQuery: TeamSelectorQuery,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly teamSelectorService: TeamSelectorService
	) {}
	public ngOnInit(): void {
		this.taskSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
		this.teamSelectorService
			.getAll$()
			.pipe(
				filter((data) => !data.some((value) => value.id === this.teamSelectorService.selectedId)),
				tap(() => (this.teamSelectorService.selected = null)),
				untilDestroyed(this)
			)
			.subscribe();
		this.teamSelectorQuery.selected$
			.pipe(
				filter(Boolean),
				tap(() => this.projectSelectorService.resetPage()),
				tap(() => this.taskSelectorService.resetPage()),
				concatMap(() => this.projectSelectorService.load()),
				concatMap(() => this.taskSelectorService.load()),
				untilDestroyed(this)
			)
			.subscribe();
		this.search$
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				tap(() => this.teamSelectorService.resetPage()),
				switchMap((searchTerm) => this.teamSelectorService.load({ searchTerm })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
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

	public change(teamId: IOrganizationTeam['id']) {
		this.teamSelectorStore.updateSelected(teamId);
	}

	public get isLoading$(): Observable<boolean> {
		return this.teamSelectorQuery.selectLoading();
	}

	public get disabled$(): Observable<boolean> {
		return this.timeTrackerQuery.disabled$;
	}

	public onShowMore(): void {
		this.teamSelectorService.onScrollToEnd();
	}
}
