import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IPagination, ITask, TaskListTypeEnum } from '@gauzy/contracts';
import { map, tap } from 'rxjs/operators';
import { TasksService } from './tasks.service';

@Injectable({
	providedIn: 'root'
})
export class TasksStoreService {
	private _tasks$: BehaviorSubject<ITask[]> = new BehaviorSubject([]);
	public tasks$: Observable<ITask[]> = this._tasks$.asObservable().pipe(map(this._mapToViewModel));

	private _selectedTask$: BehaviorSubject<ITask> = new BehaviorSubject(null);
	public selectedTask$: Observable<ITask> = this._selectedTask$.asObservable();

	get tasks(): ITask[] {
		return this._tasks$.getValue();
	}

	constructor(
		private readonly _taskService: TasksService
	) {}

	fetchTasks(
		tenantId: string,
		organizationId: string
	): Observable<IPagination<ITask>> {
		return this._taskService
			.getAllTasks({
				tenantId,
				organizationId
			})
			.pipe(
				tap(({ items }) => this.loadAllTasks(items)),
			);
	}

	private _mapToViewModel(tasks) {
		return tasks.map((task) => ({
			...task,
			projectName: task.project ? task.project.name : null,
			employees: task.members ? task.members : null
		}));
	}

	loadAllTasks(tasks: ITask[]): void {
		this._tasks$.next(tasks);
	}

	updateTasksViewMode(
		projectId: string,
		viewModeType: TaskListTypeEnum
	): void {
		this._tasks$.next([
			...this.tasks.map((task: ITask) => {
				if (
					task.projectId === projectId &&
					task.project.taskListType !== viewModeType
				) {
					return {
						...task,
						project: { ...task.project, taskListType: viewModeType }
					};
				}
				return task;
			})
		]);
	}

	createTask(task: ITask): Observable<ITask> {
		return this._taskService
			.createTask(task)
			.pipe(
				tap((createdTask) => {
					const tasks = [...this.tasks, createdTask];
					this._tasks$.next(tasks);
				})
			);
	}

	editTask(task: ITask): Observable<ITask> {
		return this._taskService
			.editTask(task)
			.pipe(
				tap(() => {
					const tasks = [...this.tasks];
					const newState = tasks.map((t) =>
						t.id === task.id ? { ...t, ...task } : t
					);
					this._tasks$.next(newState);
				})
			);
	}

	delete(id: string): Observable<void> {
		return this._taskService
			.deleteTask(id)
			.pipe(
				tap(() => {
					const tasks = [...this.tasks];
					const newState = tasks.filter((t) => t.id !== id);
					this._tasks$.next(newState);
				})
			);
	}

	selectTask(task: ITask) {
		this._selectedTask$.next(task);
	}
}
