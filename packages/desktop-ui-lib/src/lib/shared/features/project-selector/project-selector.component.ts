import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganizationProject } from 'packages/contracts/dist';
import { concatMap, debounceTime, distinctUntilChanged, filter, Observable, Subject, switchMap, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../team-selector/+state/team-selector.service';
import { ProjectSelectorQuery } from './+state/project-selector.query';
import { ProjectSelectorService } from './+state/project-selector.service';
import { ProjectSelectorStore } from './+state/project-selector.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-project-selector',
	templateUrl: './project-selector.component.html',
	styleUrls: ['./project-selector.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectSelectorComponent implements OnInit {
	public search$ = new Subject<string>();
	constructor(
		private readonly electronService: ElectronService,
		private readonly projectSelectorStore: ProjectSelectorStore,
		private readonly projectSelectorQuery: ProjectSelectorQuery,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly timeTrackerQuery: TimeTrackerQuery
	) {}

	public ngOnInit(): void {
		this.projectSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
		this.projectSelectorQuery.selected$
			.pipe(
				filter(Boolean),
				concatMap(() => Promise.allSettled([this.teamSelectorService.load(), this.taskSelectorService.load()])),
				untilDestroyed(this)
			)
			.subscribe();
		this.projectSelectorService
			.getAll$()
			.pipe(
				filter((data) => !data.some((value) => value.id === this.projectSelectorService.selectedId)),
				tap(() => (this.projectSelectorService.selected = null)),
				untilDestroyed(this)
			)
			.subscribe();
		this.search$
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				tap(() => this.projectSelectorService.resetPage()),
				switchMap((searchTerm) => this.projectSelectorService.load({ searchTerm })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public addProject = async (name: IOrganizationProject['name']) => {
		return this.projectSelectorService.addProject(name);
	};

	public get error$(): Observable<string> {
		return this.projectSelectorQuery.selectError();
	}

	public get selected$(): Observable<IOrganizationProject> {
		return this.projectSelectorQuery.selected$;
	}

	public get data$(): Observable<IOrganizationProject[]> {
		return this.projectSelectorQuery.data$;
	}

	public change(projectId: IOrganizationProject['id']) {
		this.projectSelectorStore.updateSelected(projectId);
	}

	public get isLoading$(): Observable<boolean> {
		return this.projectSelectorQuery.selectLoading();
	}

	public get disabled$(): Observable<boolean> {
		return this.timeTrackerQuery.disabled$;
	}

	public get hasPermission$(): Observable<boolean> {
		return this.projectSelectorService.hasPermission$;
	}

	public onShowMore(): void {
		this.projectSelectorService.onScrollToEnd();
	}
}
