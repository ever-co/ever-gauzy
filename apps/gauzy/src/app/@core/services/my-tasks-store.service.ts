import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Task } from '@gauzy/models';
import { map, tap } from 'rxjs/operators';
import { TasksService } from './tasks.service';

@Injectable({
	providedIn: 'root'
})
export class MyTasksStoreService {
	private _myTasks$: BehaviorSubject<Task[]> = new BehaviorSubject([]);
	public myTasks$: Observable<Task[]> = this._myTasks$
		.asObservable()
		.pipe(map(this._mapToViewModel));

	private _selectedTask$: BehaviorSubject<Task> = new BehaviorSubject(null);
	public selectedTask$: Observable<Task> = this._selectedTask$.asObservable();

	get myTasks(): Task[] {
		return this._myTasks$.getValue();
	}

	constructor(private _taskService: TasksService) {
		if (!this.myTasks.length) {
			this.fetchTasks();
		}
	}

	fetchTasks() {
		this._taskService
			.getMyTasks()
			.pipe(tap(({ items }) => this.loadAllTasks(items)))
			.subscribe();
	}

	private _mapToViewModel(tasks) {
		return tasks.map((task) => ({
			...task,
			projectName: task.project ? task.project.name : undefined,
			employees: task.members ? task.members : undefined
		}));
	}

	loadAllTasks(tasks: Task[]): void {
		this._myTasks$.next(tasks);
	}

	createTask(task: Task): void {
		this._taskService
			.createTask(task)
			.pipe(
				tap((createdTask) => {
					const tasks = [...this.myTasks, createdTask];
					this._myTasks$.next(tasks);
				})
			)
			.subscribe();
	}

	editTask(task: Task): void {
		this._taskService
			.editTask(task)
			.pipe(
				tap(() => {
					const tasks = [...this.myTasks];
					const newState = tasks.map((t) =>
						t.id === task.id ? task : t
					);
					this._myTasks$.next(newState);
				})
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
				})
			)
			.subscribe();
	}

	selectTask(task: Task) {
		this._selectedTask$.next(task);
	}
}
