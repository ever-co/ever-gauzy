import { Injectable } from '@angular/core';
import { normalizeShortcut } from './quick-action-shortcut.util';

/** Runs the Quick Action a shortcut is bound to; answers whether one ran. */
export type QuickActionShortcutRunner = (shortcut: string) => boolean;

/**
 * QuickActionShortcutBridge
 *
 * Lets another keyboard listener hand a key back to the header's Quick Actions. A plugin's shortcut registry that
 * takes a key first (the task views' `G` sequences start with `G`, which also opens "Create team") swallows the key
 * press while it waits for the rest of a sequence; when no sequence follows, it runs the Quick Action that key would
 * have run through this bridge, so the key keeps working as it did. The header registers its runner while it
 * listens; without one (no header, or the Quick Actions being customized) `run` does nothing.
 */
@Injectable({ providedIn: 'root' })
export class QuickActionShortcutBridge {
	private runner: QuickActionShortcutRunner | null = null;

	/** Sets the runner; the returned function removes it again (only if it is still the one set). */
	register(runner: QuickActionShortcutRunner): () => void {
		this.runner = runner;
		return () => {
			if (this.runner === runner) {
				this.runner = null;
			}
		};
	}

	/** Runs the Quick Action bound to the shortcut (hotkeys-js syntax: `g`, `shift+g`); `true` when one ran. */
	run(shortcut: string): boolean {
		const canonical = normalizeShortcut(shortcut);
		if (!canonical || !this.runner) {
			return false;
		}
		try {
			return this.runner(canonical);
		} catch {
			return false;
		}
	}
}
