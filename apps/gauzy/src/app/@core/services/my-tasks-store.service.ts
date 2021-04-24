import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IOrganization, ITask } from '@gauzy/contracts';
import { map, tap } from 'rxjs/operators';
import { TasksService } from './tasks.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class MyTasksStoreService {
	private _myTasks$: BehaviorSubject<ITask[]> = new BehaviorSubject([]);
	public myTasks$: Observable<ITask[]> = this._myTasks$
		.asObservable()
		.pipe(map(this._mapToViewModel));

	private _selectedTask$: BehaviorSubject<ITask> = new BehaviorSubject(null);
	public selectedTask$: Observable<ITask> = this._selectedTask$.asObservable();

	get myTasks(): ITask[] {
		return this._myTasks$.getValue();
	}

	constructor(private _taskService: TasksService) {}

	fetchTasks(organization?: IOrganization) {
		const findObj = {};
		if (organization) {
			const { id: organizationId, tenantId } = organization;
			findObj['organizationId'] = organizationId;
			findObj['tenantId'] = tenantId;
		}
		this._taskService
			.getMyTasks(findObj)
			.pipe(
				tap(({ items }) => this.loadAllTasks(items)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _mapToViewModel(tasks) {
		return tasks.map((task) => ({
			...task,
			projectName: task.project ? task.project.name : undefined,
			employees: task.members ? task.members : undefined,
			creator: task.creator
				? `${task.creator.firstName} ${task.creator.lastName}`
				: null
		}));
	}

	loadAllTasks(tasks: ITask[]): void {
		this._myTasks$.next(tasks);
	}

	createTask(task: ITask): void {
		this._taskService
			.createTask(task)
			.pipe(
				tap((createdTask) => {
					const tasks = [...this.myTasks, createdTask];
					this._myTasks$.next(tasks);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	editTask(task: ITask): void {
		this._taskService
			.editTask(task)
			.pipe(
				tap(() => {
					const tasks = [...this.myTasks];
					const newState = tasks.map((t) =>
						t.id === task.id ? task : t
					);
					this._myTasks$.next(newState);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	delete(id: string): void {
		this._taskService
			.deleteTask(id)
			.pipe(
				tap(() => {
					const tasks = [...this.myTasks];
					const newState = tasks.filter((t) => t.id !== id);
					this._myTasks$.next(newState);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectTask(task: ITask) {
		this._selectedTask$.next(task);
	}
}
