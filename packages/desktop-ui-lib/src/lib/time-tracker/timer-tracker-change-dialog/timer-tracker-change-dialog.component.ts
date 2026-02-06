import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogRef, NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, concatMap, filter, map, Observable, startWith, tap } from 'rxjs';
import { TimeTrackerQuery } from '../+state/time-tracker.query';
import { IgnitionState, TimeTrackerStore } from '../+state/time-tracker.store';
import { Store } from '../../services';
import { ClientSelectorService } from '../../shared/features/client-selector/+state/client-selector.service';
import { ProjectSelectorService } from '../../shared/features/project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../../shared/features/task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../../shared/features/team-selector/+state/team-selector.service';
import {
	ITimeTrackerFormState,
	TimeTrackerFormService
} from '../../shared/features/time-tracker-form/time-tracker-form.service';
import { DynamicSelectorValidation } from '../../shared/utils/validation/dynamic-selector-factory.validator';
import { AsyncPipe } from '@angular/common';
import { ClientSelectorComponent } from '../../shared/features/client-selector/client-selector.component';
import { ErrorMessageComponent } from '../../shared/components/ui/error-message/error-message.component';
import { ProjectSelectorComponent } from '../../shared/features/project-selector/project-selector.component';
import { TeamSelectorComponent } from '../../shared/features/team-selector/team-selector.component';
import { TaskSelectorComponent } from '../../shared/features/task-selector/task-selector.component';
import { NoteComponent } from '../../shared/features/note/note.component';
import { SpinnerButtonDirective } from '../../directives/spinner-button.directive';
import { TranslatePipe } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-timer-tracker-change-dialog',
	templateUrl: './timer-tracker-change-dialog.component.html',
	styleUrls: ['./timer-tracker-change-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		ClientSelectorComponent,
		ErrorMessageComponent,
		ProjectSelectorComponent,
		TeamSelectorComponent,
		TaskSelectorComponent,
		NoteComponent,
		NbButtonModule,
		SpinnerButtonDirective,
		NbIconModule,
		AsyncPipe,
		TranslatePipe
	]
})
export class TimerTrackerChangeDialogComponent implements OnInit {
	private lastSelectorState: ITimeTrackerFormState;
	public form: FormGroup = new FormGroup({
		clientId: new FormControl(null, this.requiredValidator(this.organization?.requireClient)),
		projectId: new FormControl(null, this.requiredValidator(this.organization?.requireProject)),
		teamId: new FormControl(null),
		taskId: new FormControl(null, this.requiredValidator(this.organization?.requireTask)),
		note: new FormControl(null, this.requiredValidator(this.organization?.requireDescription))
	});
	constructor(
		private dialogRef: NbDialogRef<TimerTrackerChangeDialogComponent>,
		private readonly timeTrackerStore: TimeTrackerStore,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly timeTrackerFormService: TimeTrackerFormService,
		private readonly projectSelectorService: ProjectSelectorService,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly clientSelectorService: ClientSelectorService,
		private readonly store: Store
	) {}

	public ngOnInit(): void {
		this.timeTrackerQuery.ignition$
			.pipe(
				filter(({ state }) => state === IgnitionState.STOPPED),
				tap(() => this.dismiss()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerQuery.ignition$
			.pipe(
				filter(({ state }) => state === IgnitionState.RESTARTED),
				tap(() => this.timeTrackerStore.update({ ignition: { state: IgnitionState.STARTED } })),
				tap(() => this.dismiss(this.lastSelectorState)),
				untilDestroyed(this)
			)
			.subscribe();
		this.setCurrentState();
		combineLatest([
			this.form.get('clientId').valueChanges.pipe(startWith(this.clientSelectorService.selectedId)),
			this.form.get('teamId').valueChanges.pipe(startWith(this.teamSelectorService.selectedId))
		])
			.pipe(
				distinctUntilChange(),
				tap(() => this.projectSelectorService.resetPage()),
				concatMap(([organizationContactId, organizationTeamId]) =>
					this.projectSelectorService.load({ organizationContactId, organizationTeamId })
				),
				untilDestroyed(this)
			)
			.subscribe();
		this.form
			.get('projectId')
			.valueChanges.pipe(
				distinctUntilChange(),
				tap(() => this.teamSelectorService.resetPage()),
				tap(() => this.taskSelectorService.resetPage()),
				concatMap((projectId) =>
					Promise.allSettled([
						this.teamSelectorService.load({ projectId }),
						this.taskSelectorService.load({ projectId })
					])
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private setCurrentState() {
		this.form.patchValue(this.timeTrackerFormService.getState());
	}

	public applyChanges() {
		if (this.form.invalid) return;
		this.lastSelectorState = this.form.value;
		this.timeTrackerStore.ignition({ state: IgnitionState.RESTARTING, data: this.form.value });
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

	public dismiss(data?) {
		this.timeTrackerStore.update({ isEditing: false });
		this.dialogRef.close(data);
	}

	public get organization() {
		return this.store.selectedOrganization;
	}

	public requiredValidator(value: boolean) {
		return DynamicSelectorValidation.requiredValidator(value);
	}
}
