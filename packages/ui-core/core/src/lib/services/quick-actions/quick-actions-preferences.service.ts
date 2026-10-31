import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { IQuickActionsUiPreferences, IUser, IUserUiPreferences } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { UsersService } from '../users/users.service';
import { resolveQuickActionShortcuts, sanitizeQuickActionsPreferences } from './quick-actions-preferences.util';

/** The validated `quickActions` customization of a user, `null` for "the defaults". */
function readQuickActionsPreferences(user: IUser | null | undefined): IQuickActionsUiPreferences | null {
	return sanitizeQuickActionsPreferences(user?.uiPreferences?.quickActions);
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * QuickActionsPreferencesService
 *
 * The signed-in user's customization of the Quick Actions dialog — the order of the actions and
 * their keyboard shortcuts — kept in the user's server-side UI preferences under `quickActions`
 * (`PUT /user/ui-preferences`, so it follows the user to every browser and device).
 *
 * Reads come from `Store.user` (what `GET /user/me` returned, or what the last write merged); a
 * write updates `Store.user` with the merged result, so every reader — the header's shortcuts, the
 * dialog — follows at once. A user who never customized anything gets `null`, i.e. the defaults.
 */
@Injectable({ providedIn: 'root' })
export class QuickActionsPreferencesService {
	private readonly store = inject(Store);
	private readonly usersService = inject(UsersService);

	/**
	 * True while the Quick Actions dialog is being customized. The global quick-action shortcuts are
	 * paused meanwhile, so recording a new shortcut or pressing a key on an edit control never
	 * navigates away from unsaved changes.
	 */
	readonly editing = signal(false);

	/** The saved customization, `null` for the defaults. Emits on change only. */
	readonly preferences$: Observable<IQuickActionsUiPreferences | null> = this.store.user$.pipe(
		map((user: IUser) => readQuickActionsPreferences(user)),
		distinctUntilChanged(sameJson)
	);

	/** The effective shortcut of every built-in action (action id → shortcut, `''` for none). */
	readonly shortcuts$: Observable<Record<string, string>> = this.preferences$.pipe(
		map((preferences) => resolveQuickActionShortcuts(preferences))
	);

	/** The saved customization right now, `null` for the defaults. */
	get preferences(): IQuickActionsUiPreferences | null {
		return readQuickActionsPreferences(this.store.user);
	}

	/**
	 * Saves the customization (`null` removes it: back to the defaults) and mirrors the merged
	 * preferences into `Store.user`. Rejects when the request fails; nothing changes then.
	 */
	async save(preferences: IQuickActionsUiPreferences | null): Promise<void> {
		const user = this.store.user;
		if (!user) {
			return;
		}
		const merged = await this.usersService.updateUiPreferences({ quickActions: preferences });
		// The user may have changed while the request was in flight.
		const current = this.store.user;
		if (!current || current.id !== user.id) {
			return;
		}
		this.store.user = { ...current, uiPreferences: this.mergedPreferences(merged, current, preferences) };
	}

	/** Removes the customization: the defaults apply again. */
	reset(): Promise<void> {
		return this.save(null);
	}

	/** What the server answered, or — if it answered nothing usable — the local equivalent of the merge. */
	private mergedPreferences(
		merged: IUserUiPreferences | null | undefined,
		user: IUser,
		preferences: IQuickActionsUiPreferences | null
	): IUserUiPreferences {
		if (merged && typeof merged === 'object' && !Array.isArray(merged)) {
			return merged;
		}
		const others: IUserUiPreferences = { ...(user.uiPreferences ?? {}) };
		delete others.quickActions;
		return preferences ? { ...others, quickActions: preferences } : others;
	}
}
