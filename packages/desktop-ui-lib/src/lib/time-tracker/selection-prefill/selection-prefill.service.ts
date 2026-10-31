import { Injectable } from '@angular/core';
import { Store } from '../../services/store.service';
import { SelectorElectronService } from '../../shared/services/selector-electron.service';
import {
	ITimeTrackerFormState,
	TimeTrackerFormService
} from '../../shared/features/time-tracker-form/time-tracker-form.service';
import { TimeTrackerStatusService } from '../time-tracker-status/time-tracker-status.service';
import { hasSelection, selectionFromLastLog, toProjectConfig } from './last-log-selection';

/**
 * Prefills the time tracker's selection from the employee's last time log (#7753), so a timer signed in on a second
 * device starts with the client, project, team, task and note last tracked with, instead of an empty form.
 *
 * It runs the first time the time tracker loads for a user and organization (online), and only over an empty
 * selection with no timer running: a selection the user makes, or clears, afterwards is left alone. What the selectors accept (an item the employee can no longer see
 * is not selected) is stored like a selection the user makes, so the timer starts with it and a refresh keeps it.
 */
@Injectable({
	providedIn: 'root'
})
export class SelectionPrefillService {
	/** The user and organization pairs the prefill already ran for. */
	private readonly _done = new Set<string>();

	constructor(
		private readonly _store: Store,
		private readonly _timeTrackerStatusService: TimeTrackerStatusService,
		private readonly _timeTrackerFormService: TimeTrackerFormService,
		private readonly _selectorElectronService: SelectorElectronService
	) {}

	/**
	 * Prefills the selection when the time tracker has none and no timer runs.
	 *
	 * @param isRunning whether the timer runs on this device, read once the server answered (the user may have
	 * started it meanwhile).
	 * @returns the selection applied, or `null` when nothing was prefilled.
	 */
	public async prefill(isRunning: () => boolean): Promise<Partial<ITimeTrackerFormState> | null> {
		const { organizationId, isOffline } = this._store;
		const key = `${this._store.user?.id ?? ''}:${organizationId ?? ''}`;

		if (!organizationId || isOffline || this._done.has(key)) {
			return null;
		}
		this._done.add(key);

		if (isRunning() || hasSelection(this._timeTrackerFormService.getState())) {
			return null;
		}

		try {
			const status = await this._timeTrackerStatusService.status();
			const selection = selectionFromLastLog({
				local: this._timeTrackerFormService.getState(),
				isRunning: isRunning(),
				status,
				organizationId
			});

			if (!selection) {
				return null;
			}

			this._timeTrackerFormService.setState(selection);
			this._storeAccepted(selection);
			return selection;
		} catch (error) {
			console.warn('[SelectionPrefill] Could not read the last time log, the selection stays empty', error);
			return null;
		}
	}

	/** Lets the prefill run again, e.g. in an organization just switched to (the switch clears the selection). */
	public reset(): void {
		this._done.clear();
	}

	/** Stores the part of `selection` the selectors accepted, as a selection the user makes would be. */
	private _storeAccepted(selection: Partial<ITimeTrackerFormState>): void {
		const applied = this._timeTrackerFormService.getState();
		const accepted: Partial<ITimeTrackerFormState> = {};
		for (const field of Object.keys(selection) as Array<keyof ITimeTrackerFormState>) {
			accepted[field] = applied[field];
		}

		const config = toProjectConfig(accepted);
		if (Object.keys(config).length > 0) {
			this._selectorElectronService.update(config);
		}
	}
}
