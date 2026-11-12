import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { IKeyboardUiPreferences, IUser, IUserUiPreferences } from '@gauzy/contracts';
import { QuickActionShortcutBridge, QuickActionsPreferencesService, Store, UsersService } from '@gauzy/ui-core/core';
import { SHORTCUT_SEQUENCE_TIMEOUT_MS } from '../task-views-ui.constants';
import {
	DIALOG_SAFE_COMMANDS,
	effectiveBindings,
	hotkeysShortcutOf,
	isDialogOpen,
	isMacPlatform,
	isActivationKey,
	isControlTarget,
	isTypingTarget,
	matchKeys,
	overridesOf,
	SHORTCUT_COMMANDS,
	ShortcutBinding,
	ShortcutChord,
	ShortcutCommand,
	chordOfEvent,
	withOverride
} from './shortcut-registry';

/** What a handler is told about the key press that ran it. */
export interface ShortcutInvocation {
	commandId: string;
	/** Shift was pressed beyond the binding: extend the selection (`Shift+J`), select a range (`Shift+X`). */
	extend: boolean;
	event: KeyboardEvent;
}

export interface ShortcutHandler {
	run: (invocation: ShortcutInvocation) => void;
	/** Whether the command can run right now (a task command needs a selection); absent means always. */
	enabled?: () => boolean;
}

/** The keyboard preferences of a user as stored: the overrides (command id → binding). */
export function keyboardOverridesOf(user: Pick<IUser, 'uiPreferences'> | null | undefined): Record<string, string> {
	return overridesOf((user?.uiPreferences as IUserUiPreferences | undefined)?.keyboard?.bindings);
}

/**
 * The shortcut registry of the app: the single source of truth for the commands, their bindings in force (the
 * defaults with the signed-in person's overrides from `uiPreferences.keyboard`) and the handlers that run them.
 *
 * One key listener, on the window in the capture phase, so a key the registry takes never also reaches the header's
 * Quick Actions (hotkeys-js listens on the document). It leaves alone keys typed into fields and editors (a ⌘/Ctrl
 * chord aside), and everything but the help while a dialog is open. Only commands with a registered, enabled handler
 * match: a page registers its own (the list's keys) while it is shown, so a key the registry has no use for right
 * now goes on to whoever else listens. A `G` waiting for the rest of its sequence is swallowed; when none follows
 * (another key, or 1.2 s), the Quick Action bound to it runs through `QuickActionShortcutBridge`.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutRegistryService implements OnDestroy {
	private readonly store = inject(Store);
	private readonly users = inject(UsersService);
	private readonly zone = inject(NgZone);
	private readonly document = inject(DOCUMENT);
	private readonly bridge = inject(QuickActionShortcutBridge, { optional: true });
	private readonly quickActions = inject(QuickActionsPreferencesService, { optional: true });

	readonly commands: readonly ShortcutCommand[] = SHORTCUT_COMMANDS;
	readonly isMac = isMacPlatform(this.document?.defaultView?.navigator);

	private readonly overridesState = signal<Record<string, string>>({});
	/** The person's overrides as stored (other clients' commands included). */
	readonly overrides = this.overridesState.asReadonly();
	/** The bindings in force, by command id (`null`: the person removed the key). */
	readonly bindings = computed<Map<string, ShortcutBinding | null>>(() =>
		effectiveBindings(this.commands, this.overridesState())
	);

	private readonly pausedState = signal(false);
	/** True while a binding is being recorded: no command runs. */
	readonly paused = this.pausedState.asReadonly();

	/** Bumps whenever a handler comes or goes, so what reads `isRunnable` can follow. */
	readonly handlersVersion = signal(0);

	private readonly handlers = new Map<string, ShortcutHandler[]>();
	private pending: ShortcutChord[] = [];
	private pendingTimer: ReturnType<typeof setTimeout> | null = null;
	private listening = false;
	private readonly subscription = new Subscription();

	private readonly onKeydown = (event: KeyboardEvent) => this.handleKeydown(event);

	constructor() {
		this.subscription.add(
			this.store.user$
				.pipe(
					map((user: IUser | null | undefined) => keyboardOverridesOf(user)),
					distinctUntilChanged(
						(a: Record<string, string>, b: Record<string, string>) =>
							JSON.stringify(a) === JSON.stringify(b)
					)
				)
				.subscribe((overrides: Record<string, string>) => this.overridesState.set(overrides))
		);
	}

	/** Starts listening (where the task views are served). Idempotent. */
	mount(): void {
		if (this.listening) return;
		const view = this.document?.defaultView;
		if (!view) return;
		this.listening = true;
		this.zone.runOutsideAngular(() => view.addEventListener('keydown', this.onKeydown, { capture: true }));
	}

	/** Stops listening and forgets a sequence under way. */
	unmount(): void {
		if (!this.listening) return;
		this.listening = false;
		this.document?.defaultView?.removeEventListener('keydown', this.onKeydown, { capture: true });
		this.clearPending();
	}

	get isMounted(): boolean {
		return this.listening;
	}

	/**
	 * Registers what a command does; the handler registered last runs (a dialog's over a page's). Answers the
	 * function that removes it again.
	 */
	register(commandId: string, handler: ShortcutHandler): () => void {
		const list = this.handlers.get(commandId) ?? [];
		list.push(handler);
		this.handlers.set(commandId, list);
		this.handlersVersion.update((version) => version + 1);
		return () => {
			const current = this.handlers.get(commandId) ?? [];
			const next = current.filter((item) => item !== handler);
			if (next.length) this.handlers.set(commandId, next);
			else this.handlers.delete(commandId);
			this.handlersVersion.update((version) => version + 1);
		};
	}

	/** Registers several commands at once; the returned function removes them all. */
	registerAll(handlers: Record<string, ShortcutHandler | ShortcutHandler['run']>): () => void {
		const removers = Object.entries(handlers).map(([commandId, handler]) =>
			this.register(commandId, typeof handler === 'function' ? { run: handler } : handler)
		);
		return () => removers.forEach((remove) => remove());
	}

	/** Runs a command as its keys would (a button doing what a shortcut does); `false` when nothing can run it now. */
	invoke(commandId: string): boolean {
		const handler = this.handlerOf(commandId);
		if (!handler) return false;
		this.zone.run(() => handler.run({ commandId, extend: false, event: new KeyboardEvent('keydown') }));
		return true;
	}

	/** Whether a command has a handler that can run now. */
	isRunnable(commandId: string): boolean {
		return !!this.handlerOf(commandId);
	}

	/** The binding in force of a command. */
	bindingOf(commandId: string): ShortcutBinding | null {
		return this.bindings().get(commandId) ?? null;
	}

	/** Pauses every command (while a binding is recorded), and the header's Quick Actions with it. */
	setPaused(paused: boolean): void {
		if (this.pausedState() === paused) return;
		this.pausedState.set(paused);
		this.clearPending();
		this.quickActions?.setEditing(paused);
	}

	/**
	 * Saves a command's binding (`null` removes its key, `'default'` puts the default back) to the person's
	 * preferences, keeping what other clients stored: other commands' overrides and any other key of the feature.
	 * Rejects when the request fails; nothing changes then.
	 */
	async saveBinding(commandId: string, binding: ShortcutBinding | null | 'default'): Promise<void> {
		const command = this.commands.find((item) => item.id === commandId);
		if (!command || command.fixed) return;
		await this.saveOverrides(withOverride(this.overridesState(), command, binding));
	}

	/** Puts every default back: the overrides of this client's commands go, other clients' stay. */
	async resetAll(): Promise<void> {
		const known = new Set(this.commands.map((command) => command.id));
		const kept = Object.fromEntries(Object.entries(this.overridesState()).filter(([id]) => !known.has(id)));
		await this.saveOverrides(kept);
	}

	ngOnDestroy(): void {
		this.unmount();
		this.subscription.unsubscribe();
	}

	// ---------------------------------------------------------------- the key listener

	/** Handles one key press (the window listener calls it; public for the specs). */
	handleKeydown(event: KeyboardEvent): void {
		if (this.pausedState() || event.defaultPrevented || event.isComposing) return;
		const chord = chordOfEvent(event, this.isMac ? 'mac' : 'other');
		if (!chord) return;
		// Enter and Space on a focused button, link or box do what that control does.
		if (!this.pending.length && isActivationKey(chord) && isControlTarget(event.target, chord.key)) return;
		if (isTypingTarget(event.target) && !chord.mod) {
			// Letters typed into a field are text: a sequence started before the person moved into it is dropped.
			this.clearPending();
			return;
		}
		const dialogOpen = isDialogOpen(this.document);
		const runnable = this.runnableCommands(dialogOpen);
		const pressed = [...this.pending, chord];
		const { match, pending } = matchKeys(pressed, runnable, this.bindings());
		if (match) {
			this.clearPending();
			this.take(event);
			this.run(match.command.id, { commandId: match.command.id, extend: match.extend, event });
			return;
		}
		if (pending) {
			this.take(event);
			this.pending = pressed;
			this.restartTimer();
			return;
		}
		if (this.pending.length) {
			// The sequence went nowhere: its first key does what it does without the registry, and this key is
			// read again on its own (it may start a sequence, or be a command, or go on to the page).
			this.fallBack();
			this.handleKeydown(event);
		}
	}

	private runnableCommands(dialogOpen: boolean): ShortcutCommand[] {
		return this.commands.filter(
			(command) => (!dialogOpen || DIALOG_SAFE_COMMANDS.has(command.id)) && !!this.handlerOf(command.id)
		);
	}

	private handlerOf(commandId: string): ShortcutHandler | null {
		const list = this.handlers.get(commandId);
		if (!list?.length) return null;
		for (let at = list.length - 1; at >= 0; at -= 1) {
			const handler = list[at];
			if (!handler.enabled || handler.enabled()) return handler;
		}
		return null;
	}

	private run(commandId: string, invocation: ShortcutInvocation): void {
		const handler = this.handlerOf(commandId);
		if (!handler) return;
		this.zone.run(() => handler.run(invocation));
	}

	private take(event: KeyboardEvent): void {
		event.preventDefault();
		event.stopImmediatePropagation();
	}

	private restartTimer(): void {
		if (this.pendingTimer) clearTimeout(this.pendingTimer);
		this.pendingTimer = setTimeout(() => this.fallBack(), SHORTCUT_SEQUENCE_TIMEOUT_MS);
	}

	/**
	 * Gives the first key of an unfinished sequence to the Quick Action it is bound to, and forgets the sequence;
	 * not when the person has meanwhile moved into a field or a dialog opened (the key would not have reached the
	 * Quick Actions there either).
	 */
	private fallBack(): void {
		const [first] = this.pending;
		this.clearPending();
		if (!first || !this.bridge || this.pausedState()) return;
		if (isTypingTarget(this.document?.activeElement ?? null) || isDialogOpen(this.document)) return;
		this.zone.run(() => this.bridge?.run(hotkeysShortcutOf(first)));
	}

	private clearPending(): void {
		this.pending = [];
		if (this.pendingTimer) {
			clearTimeout(this.pendingTimer);
			this.pendingTimer = null;
		}
	}

	private async saveOverrides(bindings: Record<string, string>): Promise<void> {
		const user = this.store.user as IUser | null | undefined;
		if (!user) return;
		const stored = ((user.uiPreferences as IUserUiPreferences | undefined)?.keyboard ??
			{}) as IKeyboardUiPreferences;
		const keyboard: IKeyboardUiPreferences = { ...stored, bindings };
		const merged = await this.users.updateUiPreferences({ keyboard });
		// The user may have changed while the request was in flight.
		const current = this.store.user as IUser | null | undefined;
		if (!current || current.id !== user.id) return;
		const answered =
			merged && typeof merged === 'object' && !Array.isArray(merged)
				? (merged as IUserUiPreferences).keyboard
				: undefined;
		this.store.user = {
			...current,
			uiPreferences: { ...((current.uiPreferences as IUserUiPreferences) ?? {}), keyboard: answered ?? keyboard }
		} as IUser;
		this.overridesState.set(overridesOf((answered ?? keyboard).bindings));
	}
}
