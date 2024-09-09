import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, map, Observable, startWith, tap } from 'rxjs';
import { TimeTrackerQuery } from '../+state/time-tracker.query';
import { IgnitionState, TimeTrackerStore } from '../+state/time-tracker.store';
import { TimeTrackerFormService } from '../../shared/features/time-tracker-form/time-tracker-form.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-timer-tracker-change-dialog',
	templateUrl: './timer-tracker-change-dialog.component.html',
	styleUrls: ['./timer-tracker-change-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimerTrackerChangeDialogComponent implements OnInit {
	private currentState!: any;
	constructor(
		private dialogRef: NbDialogRef<TimerTrackerChangeDialogComponent>,
		private readonly timeTrackerStore: TimeTrackerStore,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly timeTrackerFormService: TimeTrackerFormService
	) {}
	public ngOnInit(): void {
		this.timeTrackerQuery.ignition$
			.pipe(
				filter(({ state }) => state === IgnitionState.RESTARTED),
				tap(() => this.timeTrackerStore.update({ ignition: { state: IgnitionState.STARTED } })),
				tap(() => this.setCurrentState()),
				tap(() => this.dismiss()),
				untilDestroyed(this)
			)
			.subscribe();
		this.setCurrentState();
	}

	private setCurrentState() {
		this.currentState = this.timeTrackerFormService.getState();
	}

	public applyChanges() {
		this.timeTrackerStore.update({ ignition: { state: IgnitionState.RESTARTING } });
	}

	public get isRestarting$(): Observable<boolean> {
		return this.timeTrackerQuery.ignition$.pipe(
			map(({ state }) => state !== IgnitionState.STARTED),
			startWith(false)
		);
	}

	public get expanded$(): Observable<boolean> {
		return this.timeTrackerQuery.isExpanded$;
	}

	public dismiss() {
		this.timeTrackerStore.update({ isEditing: false });
		this.timeTrackerFormService.setState(this.currentState);
		this.dialogRef.close();
	}
}
