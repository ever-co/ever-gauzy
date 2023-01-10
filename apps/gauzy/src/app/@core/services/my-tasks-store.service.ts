import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IPagination, ITask } from '@gauzy/contracts';
import { map, tap } from 'rxjs/operators';
import { TasksService } from './tasks.service';

@Injectable({
	providedIn: 'root'
})
export class MyTasksStoreService {
	private _myTasks$: BehaviorSubject<ITask[]> = new BehaviorSubject([]);
	public myTasks$: Observable<ITask[]> = this._myTasks$.asObservable().pipe(map(this._mapToViewModel));

	private _selectedTask$: BehaviorSubject<ITask> = new BehaviorSubject(null);
	public selectedTask$: Observable<ITask> = this._selectedTask$.asObservable();

	get myTasks(): ITask[] {
		return this._myTasks$.getValue();
	}

	constructor(
		private readonly _taskService: TasksService
	) {}

	fetchTasks(
		tenantId: string,
		organizationId: string
	): Observable<IPagination<ITask>> {
		return this._taskService
			.getMyTasks({ tenantId, organizationId })
			.pipe(tap(({ items }) => this.loadAllTasks(items)));
	}

	private _mapToViewModel(tasks) {
		return tasks.map((task) => ({
			...task,
			projectName: task.project ? task.project.name : undefined,
			employees: task.members ? task.members : undefined
		}));
	}

	loadAllTasks(tasks: ITask[]): void {
		this._myTasks$.next(tasks);
	}

	createTask(task: ITask): Observable<ITask> {
		return this._taskService
			.createTask(task)
			.pipe(
				tap((createdTask) => {
					const tasks = [...this.myTasks, createdTask];
					this._myTasks$.next(tasks);
				})
			);
	}

	editTask(task: ITask): Observable<ITask> {
		return this._taskService
			.editTask(task)
			.pipe(
				tap(() => {
					const tasks = [...this.myTasks];
					const newState = tasks.map((t) =>
						t.id === task.id ? task : t
					);
					this._myTasks$.next(newState);
				})
			);
	}

	delete(id: string): Observable<void> {
		return this._taskService
			.deleteTask(id)
			.pipe(
				tap(() => {
					const tasks = [...this.myTasks];
					const newState = tasks.filter((t) => t.id !== id);
					this._myTasks$.next(newState);
				})
			);
	}

	selectTask(task: ITask) {
		this._selectedTask$.next(task);
	}
}
