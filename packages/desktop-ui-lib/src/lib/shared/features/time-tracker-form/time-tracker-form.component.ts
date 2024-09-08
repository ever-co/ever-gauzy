import { ChangeDetectionStrategy, Component } from '@angular/core';
import { combineLatest, map, Observable, startWith } from 'rxjs';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { IgnitionState, TimeTrackerStore } from '../../../time-tracker/+state/time-tracker.store';
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
		private readonly timeTrackerStore: TimeTrackerStore
	) {}
	public onChange() {
		const ignition = this.timeTrackerQuery.ignition;
		const isEditing = this.timeTrackerQuery.isEditing;
		const isStarted = ignition.state === IgnitionState.STARTED;
		if (isStarted && !isEditing) {
			this.timeTrackerStore.update({ isEditing: true });
		}
	}

	public get isHideTaskSelector$(): Observable<boolean> {
		return combineLatest([this.timeTrackerQuery.isExpanded$, this.timeTrackerQuery.isEditing$]).pipe(
			map(([expanded, editing]) => !expanded || editing)
		);
	}

	public get isHideTeamSelector$(): Observable<boolean> {
		return this.teamSelectorService.getAll$().pipe(
			map((teams) => (teams?.length ?? 0) > 0),
			startWith(true)
		);
	}
}
