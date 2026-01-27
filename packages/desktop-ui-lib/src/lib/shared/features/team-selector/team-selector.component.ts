import { ChangeDetectionStrategy, Component, forwardRef, OnInit, OnDestroy } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { IOrganizationTeam } from '@gauzy/contracts';
import { combineLatest, concatMap, filter, map, Observable, of, tap } from 'rxjs';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { AbstractSelectorComponent } from '../../components/abstract/selector.abstract';
import { SelectorElectronService } from '../../services/selector-electron.service';
import { ProjectSelectorService } from '../project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorQuery } from './+state/team-selector.query';
import { TeamSelectorService } from './+state/team-selector.service';
import { TeamSelectorStore } from './+state/team-selector.store';

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
	],
	standalone: false
})
export class TeamSelectorComponent extends AbstractSelectorComponent<IOrganizationTeam> implements OnInit, OnDestroy {
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
		const sub1 = this.teamSelectorService.onScroll$.subscribe();
		this.subscriptions.add(sub1);

		const sub2 = this.teamSelectorQuery.selected$
			.pipe(
				filter(Boolean),
				tap(() => this.projectSelectorService.resetPage()),
				concatMap(() => this.projectSelectorService.load())
			)
			.subscribe();
		this.subscriptions.add(sub2);

		this.handleSearch(this.teamSelectorService);
	}

	public override ngOnDestroy(): void {
		super.ngOnDestroy();
	}

	public clear(): void {
		if (this.useStore) {
			this.selectorElectronService.update({ organizationTeamId: null });
			this.selectorElectronService.refresh();
		}
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
