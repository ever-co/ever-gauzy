import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IOrganizationSprint, IGetSprintsOptions, ITask } from '@gauzy/models';
import { SprintService } from 'apps/gauzy/src/app/@core/services/organization-sprint.service';
import { tap, take, map, switchMap } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class SprintStoreService {
	private _sprints$: BehaviorSubject<
		IOrganizationSprint[]
	> = new BehaviorSubject([]);
	sprints$: Observable<IOrganizationSprint[]> = this._sprints$.asObservable();

	private get sprints(): IOrganizationSprint[] {
		return this._sprints$.getValue();
	}

	constructor(private sprintService: SprintService) {
		if (!this.sprints.length) {
			this.fetchSprints();
		}
	}

	fetchSprints(findInput: IGetSprintsOptions = {}) {
		this.sprintService
			.getAllSprints(findInput)
			.pipe(tap(({ items }) => this.loadAllSprints(items)))
			.subscribe();
	}

	loadAllSprints(sprints: IOrganizationSprint[]): void {
		this._sprints$.next(sprints);
	}

	createSprint(
		newSprint: IOrganizationSprint
	): Observable<IOrganizationSprint> {
		return this.sprintService.createSprint(newSprint).pipe(
			tap((createdSprint: IOrganizationSprint) => {
				const sprints = [...this.sprints, createdSprint];
				this._sprints$.next(sprints as IOrganizationSprint[]);
			}),
			take(1)
		);
	}

	updateSprint(
		editedSprint: IOrganizationSprint
	): Observable<IOrganizationSprint> {
		return this.sprintService
			.editSprint(editedSprint.id, editedSprint)
			.pipe(
				tap(() => {
					const sprints = [...this.sprints];
					const newState = sprints.map((t) =>
						t.id === editedSprint.id ? editedSprint : t
					);
					this._sprints$.next(newState);
				}),
				take(1)
			);
	}

	deleteSprint(id: string): Observable<void> {
		return this.sprintService.deleteSprint(id).pipe(
			tap(() => {
				const newState = this.sprints.filter(
					(sprint: IOrganizationSprint) => sprint.id !== id
				);
				this._sprints$.next(newState);
			}),
			take(1)
		);
	}

	moveTaskToSprint(
		sprintId: string,
		task: ITask
	): Observable<IOrganizationSprint> {
		return this.sprints$.pipe(
			map((sprints: IOrganizationSprint[]) =>
				sprints.find(
					(sprint: IOrganizationSprint) => sprint.id === sprintId
				)
			),
			switchMap(({ tasks }: IOrganizationSprint) =>
				this.sprintService.editSprint(sprintId, {
					tasks: [...tasks, task]
				})
			),
			tap((updatedSprint: IOrganizationSprint) => {
				// const sprints = [...this.sprints];
				// const newState = sprints.map((sprint: IOrganizationSprint): IOrganizationSprint =>
				//   sprint.id === updatedSprint.id ? updatedSprint : sprint
				// );
				// this._sprints$.next(newState);
			}),
			take(1)
		);
	}
}
