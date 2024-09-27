import { ChangeDetectionStrategy, Component, forwardRef, OnInit } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IOrganizationProject } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, filter, map, Observable, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { AbstractSelectorComponent } from '../../components/abstract/selector.abstract';
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
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ProjectSelectorComponent),
			multi: true
		}
	]
})
export class ProjectSelectorComponent extends AbstractSelectorComponent<IOrganizationProject> implements OnInit {
	constructor(
		private readonly electronService: ElectronService,
		private readonly projectSelectorStore: ProjectSelectorStore,
		private readonly projectSelectorQuery: ProjectSelectorQuery,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly timeTrackerQuery: TimeTrackerQuery
	) {
		super();
	}

	public ngOnInit(): void {
		this.projectSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
		this.projectSelectorQuery.selected$
			.pipe(
				filter(Boolean),
				tap(() => this.teamSelectorService.resetPage()),
				tap(() => this.taskSelectorService.resetPage()),
				concatMap(() => Promise.allSettled([this.teamSelectorService.load(), this.taskSelectorService.load()])),
				untilDestroyed(this)
			)
			.subscribe();
		this.projectSelectorService
			.getAll$()
			.pipe(
				filter((data) => !data.some((value) => value.id === this.projectSelectorService.selectedId)),
				tap(() => this.change(null)),
				untilDestroyed(this)
			)
			.subscribe();
		// Handle search logic
		this.handleSearch(this.projectSelectorService);
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

	protected updateSelected(value: IOrganizationProject['id']): void {
		// Update store only if useStore is true
		if (this.useStore) {
			this.projectSelectorStore.updateSelected(value);
		}
	}

	public get isLoading$(): Observable<boolean> {
		return this.projectSelectorQuery.selectLoading();
	}

	public get disabled$(): Observable<boolean> {
		return combineLatest([this.timeTrackerQuery.disabled$, this.isDisabled$.asObservable()]).pipe(
			map(([disabled, selectorDisabled]) => disabled || selectorDisabled)
		);
	}

	public get hasPermission$(): Observable<boolean> {
		return this.projectSelectorService.hasPermission$;
	}

	public onShowMore(): void {
		this.projectSelectorService.onScrollToEnd();
	}
}
