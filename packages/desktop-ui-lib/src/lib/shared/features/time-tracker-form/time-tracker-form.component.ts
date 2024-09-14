import { ChangeDetectionStrategy, Component } from '@angular/core';
import { combineLatest, map, Observable, startWith } from 'rxjs';
import { Store } from '../../../services';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { IgnitionState, TimerStartMode, TimeTrackerStore } from '../../../time-tracker/+state/time-tracker.store';
import { TeamSelectorService } from './../team-selector/+state/team-selector.service';

@Component({
	selector: 'gauzy-time-tracker-form',
	templateUrl: './time-tracker-form.component.html',
	styleUrls: ['./time-tracker-form.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeTrackerFormComponent {
	constructor(
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly timeTrackerStore: TimeTrackerStore,
		private readonly store: Store
	) {}
	public onChange(event: Event) {
		if (this.store.isOffline) {
			return;
		}
		const ignition = this.timeTrackerQuery.ignition;
		const isEditing = this.timeTrackerQuery.isEditing;
		const isStarted = ignition.state === IgnitionState.STARTED;
		const isRemote = ignition.mode === TimerStartMode.REMOTE;

		if (isStarted && !isEditing && !isRemote) {
			this.timeTrackerStore.update({ isEditing: true });
		}
		event.preventDefault();
	}

	public get isShowTaskSelector$(): Observable<boolean> {
		return combineLatest([this.timeTrackerQuery.isExpanded$, this.timeTrackerQuery.isEditing$]).pipe(
			map(([expanded, editing]) => !expanded || editing)
		);
	}

	public get isShowTeamSelector$(): Observable<boolean> {
		return this.teamSelectorService.getAll$().pipe(
			map((teams) => (teams?.length ?? 0) > 0),
			startWith(true)
		);
	}

	public get isShowEdit$(): Observable<boolean> {
		return combineLatest([
			this.timeTrackerQuery.disabled$,
			this.timeTrackerQuery.isStarted$,
			this.timeTrackerQuery.isRemote$
		]).pipe(map(([started, disabled, remote]) => started && disabled && !remote));
	}
}
