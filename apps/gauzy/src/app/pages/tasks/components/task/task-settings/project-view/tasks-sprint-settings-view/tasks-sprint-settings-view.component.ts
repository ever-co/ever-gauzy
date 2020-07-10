import { Component, OnInit, OnDestroy } from '@angular/core';

import * as moment from 'moment';
import { NbDialogService } from '@nebular/theme';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { tap, takeUntil, take } from 'rxjs/operators';

import { OrganizationSprint, Organization } from '@gauzy/models';
import { ItemActionControl } from 'apps/gauzy/src/app/@shared/components/items-actions/items-actions.component';
import { SprintDialogComponent } from './sprint-dialog/sprint-dialog.component';
import { SprintStoreService } from './services/sprint-store.service';

@Component({
	selector: 'ngx-tasks-sprint-settings-view',
	templateUrl: './tasks-sprint-settings-view.component.html',
	styleUrls: ['./tasks-sprint-settings-view.component.css']
})
export class TasksSprintSettingsViewComponent implements OnInit, OnDestroy {
	actionsConfig$: BehaviorSubject<ItemActionControl[]> = new BehaviorSubject(
		[]
	);
	sprints$: Observable<OrganizationSprint[]> = this.store.sprints$;
	selectedSprint: OrganizationSprint = this.store.selectedSprint;
	moment: any = moment;
	private _onDestroy$: Subject<void> = new Subject<void>();

	constructor(
		private dialogService: NbDialogService,
		private store: SprintStoreService
	) {}

	ngOnInit(): void {
		this.setItemActions();
	}

	private setItemActions(): void {
		this.actionsConfig$.next([
			{
				type: 'add',
				actionCallback: () => this.createNewSprint()
			},
			{
				type: 'edit',
				disabled: !this.store.isSprintSelected(),
				actionCallback: (index: number) => {
					this.editSprint();
				}
			},
			{
				type: 'delete',
				disabled: !this.store.isSprintSelected(),
				actionCallback: (index: number) => this.deleteSprint()
			}
		]);
	}

	selectSprint(selectedSprint: OrganizationSprint): void {
		console.log('selected item index: ', selectedSprint);
		this.store.selectSprint(selectedSprint);
		this.setItemActions();
	}

	createNewSprint(): void {
		this.dialogService
			.open(SprintDialogComponent, {
				context: {
					sprintAction: 'create'
				}
			})
			.onClose.pipe(
				tap((sprintData: OrganizationSprint) => {
					this.store.createSprint({
						...sprintData,
						organization: {} as Organization,
						tenant: { name: 'Tenant Name' }
					});
				}),
				take(1),
				takeUntil(this._onDestroy$)
			)
			.subscribe();
	}

	editSprint(): void {
		this.dialogService
			.open(SprintDialogComponent, {
				context: {
					sprintAction: 'edit',
					sprintData: this.store.selectedSprint
				}
			})
			.onClose.pipe(
				tap((updatedSprint: OrganizationSprint) => {
					this.store.updateSprint({
						...this.store.selectedSprint,
						...updatedSprint
					});
					this.setItemActions();
				}),
				take(1),
				takeUntil(this._onDestroy$)
			)
			.subscribe();
	}

	deleteSprint(): void {
		this.store.deleteSprint();
		this.setItemActions();
	}

	ngOnDestroy(): void {
		this._onDestroy$.next();
		this._onDestroy$.complete();
	}
}
