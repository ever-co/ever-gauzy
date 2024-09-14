import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { combineLatest, map, Observable, startWith } from 'rxjs';
import {
	IgnitionState,
	ITimerIgnition,
	ITimeTrackerState,
	TimerStartMode,
	TimeTrackerStore
} from './time-tracker.store';

@Injectable({ providedIn: 'root' })
export class TimeTrackerQuery extends Query<ITimeTrackerState> {
	public readonly isExpanded$: Observable<boolean> = this.select((state) => state.isExpanded);
	public readonly isRefreshing$: Observable<boolean> = this.select((state) => state.isRefreshing);
	public readonly isEditing$: Observable<boolean> = this.select((state) => state.isEditing);
	public readonly ignition$: Observable<ITimerIgnition> = this.select((state) => state.ignition);
	constructor(protected store: TimeTrackerStore) {
		super(store);
	}

	public get isExpanded(): boolean {
		return this.getValue().isExpanded;
	}

	public get isRefreshing(): boolean {
		return this.getValue().isRefreshing;
	}

	public get isEditing(): boolean {
		return this.getValue().isEditing;
	}

	public get ignition(): ITimerIgnition {
		return this.getValue().ignition;
	}

	public get isStateChanging$(): Observable<boolean> {
		return this.ignition$.pipe(
			map((ignition) => {
				const { state } = ignition;
				// Check if the state is one of the states that should disable the selector
				return [IgnitionState.STOPPING, IgnitionState.STARTING, IgnitionState.RESTARTING].includes(state);
			})
		);
	}

	public get isRemote$(): Observable<boolean> {
		return this.ignition$.pipe(map(({ mode }) => mode === TimerStartMode.REMOTE));
	}

	public get isStarted$(): Observable<boolean> {
		return this.ignition$.pipe(map(({ state }) => state === IgnitionState.STARTED));
	}

	public get disabled$(): Observable<boolean> {
		return combineLatest([
			this.isStateChanging$.pipe(startWith(false)),
			this.isEditing$.pipe(startWith(false)),
			this.isStarted$.pipe(startWith(false)),
			this.isRemote$.pipe(startWith(false))
		]).pipe(
			map(([isStateChanging, isEditing, isStarted]) => {
				return !!(isStateChanging || isEditing !== isStarted);
			})
		);
	}
}
