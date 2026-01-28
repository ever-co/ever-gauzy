import { ChangeDetectionStrategy, Component, forwardRef, OnInit, OnDestroy } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IOrganizationProject } from '@gauzy/contracts';
import { combineLatest, concatMap, filter, map, Observable, tap } from 'rxjs';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { AbstractSelectorComponent } from '../../components/abstract/selector.abstract';
import { SelectorElectronService } from '../../services/selector-electron.service';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../team-selector/+state/team-selector.service';
import { ProjectSelectorQuery } from './+state/project-selector.query';
import { ProjectSelectorService } from './+state/project-selector.service';
import { ProjectSelectorStore } from './+state/project-selector.store';

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
    ],
    standalone: false
})
export class ProjectSelectorComponent extends AbstractSelectorComponent<IOrganizationProject> implements OnInit, OnDestroy {
	constructor(
		private readonly selectorElectronService: SelectorElectronService,
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
		const sub1 = this.projectSelectorService.onScroll$.subscribe();
		this.subscriptions.add(sub1);

		const sub2 = this.projectSelectorQuery.selected$
			.pipe(
				filter(Boolean),
				tap(() => this.teamSelectorService.resetPage()),
				tap(() => this.taskSelectorService.resetPage()),
				concatMap(() => Promise.allSettled([this.teamSelectorService.load(), this.taskSelectorService.load()]))
			)
			.subscribe();
		this.subscriptions.add(sub2);

		this.handleSearch(this.projectSelectorService);
	}

	public override ngOnDestroy(): void {
		super.ngOnDestroy();
	}

	public clear(): void {
		if (this.useStore) {
			this.selectorElectronService.update({ projectId: null });
			this.selectorElectronService.refresh();
		}
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
			this.selectorElectronService.update({ projectId: value });
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
