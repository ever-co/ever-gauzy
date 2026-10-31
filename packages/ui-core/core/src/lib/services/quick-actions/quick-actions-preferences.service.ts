import { inject, Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
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
 * write puts the saved `quickActions` into `Store.user`, so every reader — the header's shortcuts,
 * the dialog — follows at once. A user who never customized anything gets `null`, i.e. the defaults.
 */
@Injectable({ providedIn: 'root' })
export class QuickActionsPreferencesService {
	private readonly store = inject(Store);
	private readonly usersService = inject(UsersService);

	private readonly editingState = signal(false);
	private readonly editingEnded = new Subject<void>();

	/**
	 * True while the Quick Actions dialog is being customized. The global quick-action shortcuts are
	 * paused meanwhile, so recording a new shortcut or pressing a key on an edit control never
	 * navigates away from unsaved changes. Changed with {@link setEditing}.
	 */
	readonly editing = this.editingState.asReadonly();

	/**
	 * Emits each time the customization ends (saved, cancelled or dialog closed), so the header binds
	 * its shortcuts again even when nothing changed: that also forgets any key hotkeys-js still
	 * thinks is held because its release was part of a recording.
	 */
	readonly editingEnded$: Observable<void> = this.editingEnded.asObservable();

	/** The saved customization, `null` for the defaults. Emits on change only. */
	readonly preferences$: Observable<IQuickActionsUiPreferences | null> = this.store.user$.pipe(
		map((user: IUser) => readQuickActionsPreferences(user)),
		distinctUntilChanged(sameJson)
	);

	/** The effective shortcut of every built-in action (action id → shortcut, `''` for none). */
	readonly shortcuts$: Observable<Record<string, string>> = this.preferences$.pipe(
		map((preferences) => resolveQuickActionShortcuts(preferences))
	);

	/** Enters (`true`) or leaves (`false`) the customization; see {@link editing}. */
	setEditing(editing: boolean): void {
		if (this.editingState() === editing) {
			return;
		}
		this.editingState.set(editing);
		if (!editing) {
			this.editingEnded.next();
		}
	}

	/** The saved customization right now, `null` for the defaults. */
	get preferences(): IQuickActionsUiPreferences | null {
		return readQuickActionsPreferences(this.store.user);
	}

	/**
	 * Saves the customization (`null` removes it: back to the defaults) and puts the saved value into
	 * `Store.user`. Rejects when the request fails; nothing changes then.
	 *
	 * Only the `quickActions` key of the stored user's preferences is replaced: another feature's
	 * preferences saved while this request was in flight (the chat panel's, say) stay as they are,
	 * even though the server's answer may predate them.
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
		this.store.user = { ...current, uiPreferences: this.withQuickActions(current, merged, preferences) };
	}

	/** Removes the customization: the defaults apply again. */
	reset(): Promise<void> {
		return this.save(null);
	}

	/**
	 * The user's preferences with `quickActions` set to what was saved: the server's copy when it
	 * answered with the merged preferences, else what was sent. No value removes the key.
	 */
	private withQuickActions(
		user: IUser,
		merged: IUserUiPreferences | null | undefined,
		sent: IQuickActionsUiPreferences | null
	): IUserUiPreferences {
		const answered = !!merged && typeof merged === 'object' && !Array.isArray(merged);
		const saved = answered ? merged.quickActions : sent;
		const preferences: IUserUiPreferences = { ...(user.uiPreferences ?? {}) };
		delete preferences.quickActions;
		return saved ? { ...preferences, quickActions: saved } : preferences;
	}
}
