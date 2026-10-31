import { Injectable } from '@angular/core';
import { Store } from '../../services/store.service';
import { ClientSelectorService } from '../../shared/features/client-selector/+state/client-selector.service';
import { ProjectSelectorService } from '../../shared/features/project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../../shared/features/task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../../shared/features/team-selector/+state/team-selector.service';
import {
	ITimeTrackerFormState,
	TimeTrackerFormService
} from '../../shared/features/time-tracker-form/time-tracker-form.service';
import { SelectorElectronService } from '../../shared/services/selector-electron.service';
import { TimeTrackerStatusService } from '../time-tracker-status/time-tracker-status.service';
import { findChoice, IPagedChoices } from './find-choice';
import { selectionFromLastLog, toProjectConfig } from './last-log-selection';
import {
	hasSelection,
	keptSelection,
	mergeSelections,
	sameSelection,
	SELECTOR_FIELDS,
	SelectorField
} from './selection-state';

/**
 * Prefills the time tracker's selection from the employee's last time log (#7753), so a timer signed in on a second
 * device starts with the client, project, team, task and note last tracked with, instead of an empty form.
 *
 * It runs once for a user and organization (online), and only over an empty selection with no timer running: a
 * selection the user makes, or clears, afterwards is left alone, and a lookup that fails is tried again on the next
 * load. The choices are made one after another, each in its selector's list as reloaded for the choices before it (a
 * project's teams and tasks once the project is chosen), so a choice the employee can no longer pick is left out. What
 * was chosen is stored like a selection the user makes, so the timer starts with it and a refresh keeps it.
 */
@Injectable({
	providedIn: 'root'
})
export class SelectionPrefillService {
	/** The user and organization pairs the prefill is settled for: it ran, or found a selection of their own. */
	private readonly _settled = new Set<string>();
	/** The lookups under way, by generation, user and organization: one at a time for each. */
	private readonly _inFlight = new Set<string>();
	/** Counts the resets: a lookup started before the latest one answers for a context left since and is dropped. */
	private _generation = 0;
	/** The selectors to choose in, by form field. */
	private readonly _lists: Readonly<Record<SelectorField, IPagedChoices<{ id?: string }>>>;

	constructor(
		private readonly _store: Store,
		private readonly _timeTrackerStatusService: TimeTrackerStatusService,
		private readonly _timeTrackerFormService: TimeTrackerFormService,
		private readonly _selectorElectronService: SelectorElectronService,
		clientSelectorService: ClientSelectorService,
		projectSelectorService: ProjectSelectorService,
		teamSelectorService: TeamSelectorService,
		taskSelectorService: TaskSelectorService
	) {
		this._lists = {
			clientId: clientSelectorService,
			projectId: projectSelectorService,
			teamId: teamSelectorService,
			taskId: taskSelectorService
		};
	}

	/**
	 * Prefills the selection when the time tracker has none and no timer runs.
	 *
	 * @param isRunning whether the timer runs on this device, read again once the server answered (the user may have
	 * started it meanwhile).
	 * @param saved the selection saved on this device: a choice the selectors could not show yet (their lists still
	 * loading) is still the user's choice, and is never replaced.
	 * @returns the selection prefilled (and stored), or `null` when nothing was.
	 */
	public async prefill(
		isRunning: () => boolean,
		saved?: Partial<ITimeTrackerFormState> | null
	): Promise<Partial<ITimeTrackerFormState> | null> {
		const { organizationId, isOffline } = this._store;
		const key = this._contextKey();
		const generation = this._generation;
		const flight = `${generation}|${key}`;

		if (!organizationId || isOffline || this._settled.has(key) || this._inFlight.has(flight)) {
			return null;
		}
		if (isRunning() || hasSelection(mergeSelections(this._timeTrackerFormService.getState(), saved))) {
			this._settled.add(key);
			return null;
		}

		// Still the user, organization and stopped timer the lookup started for (an organization switch resets).
		const isCurrent = () => generation === this._generation && this._contextKey() === key && !isRunning();

		this._inFlight.add(flight);
		try {
			const status = await this._timeTrackerStatusService.status();
			if (!isCurrent() || !status) {
				return null;
			}
			this._settled.add(key);

			const selection = selectionFromLastLog({
				local: mergeSelections(this._timeTrackerFormService.getState(), saved),
				isRunning: isRunning(),
				status,
				organizationId
			});
			const applied = selection ? await this._apply(selection, isCurrent) : null;
			const kept = applied ? this._persist(applied) : {};
			return Object.keys(kept).length > 0 ? kept : null;
		} catch (error) {
			console.warn('[SelectionPrefill] Could not read the last time log, the next load tries again', error);
			return null;
		} finally {
			this._inFlight.delete(flight);
		}
	}

	/**
	 * Lets the prefill run again, e.g. in an organization just switched to (the switch clears the selection), and drops
	 * the lookups still under way for the context left.
	 */
	public reset(): void {
		this._generation++;
		this._settled.clear();
	}

	/** The user and organization the time tracker works for. */
	private _contextKey(): string {
		return `${this._store.user?.id ?? ''}:${this._store.organizationId ?? ''}`;
	}

	/**
	 * Makes the choices of `selection` one after another, each in its selector's list as reloaded for the choices made
	 * before it, then the note.
	 *
	 * @returns what was applied; `null` when the context changed meanwhile. Once the user changes the selection, no
	 * further choice is made.
	 */
	private async _apply(
		selection: Partial<ITimeTrackerFormState>,
		isCurrent: () => boolean
	): Promise<Partial<ITimeTrackerFormState> | null> {
		const applied: Partial<ITimeTrackerFormState> = {};

		for (const field of SELECTOR_FIELDS) {
			const id = selection[field];
			if (!id) {
				continue;
			}

			const found = await findChoice(this._lists[field], id);
			if (!isCurrent()) {
				return null;
			}
			if (!sameSelection(this._timeTrackerFormService.getState(), applied)) {
				return applied; // the user took over
			}
			if (found) {
				const choice: Partial<ITimeTrackerFormState> = {};
				choice[field] = id;
				this._timeTrackerFormService.setState(choice);
				applied[field] = id;
			}
		}

		if (selection.note && !this._timeTrackerFormService.getState().note) {
			this._timeTrackerFormService.setState({ note: selection.note });
			applied.note = selection.note;
		}
		return applied;
	}

	/**
	 * Stores what the prefill applied and the form still has, as a selection the user makes would be (never over a
	 * choice the user made meanwhile).
	 *
	 * @returns the selection stored.
	 */
	private _persist(applied: Partial<ITimeTrackerFormState>): Partial<ITimeTrackerFormState> {
		const kept = keptSelection(this._timeTrackerFormService.getState(), applied);
		if (Object.keys(kept).length > 0) {
			this._selectorElectronService.update(toProjectConfig(kept));
		}
		return kept;
	}
}
