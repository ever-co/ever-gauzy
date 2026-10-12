import { useCallback, useMemo, useRef, useState } from 'react';
import { GuiDrag } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { useInjector } from '@gauzy/ui-react';
import {
	isLayoutAllHidden,
	isLayoutItemHidden,
	LayoutHistory,
	moveLayoutItem,
	restoreLayout,
	serializeLayout,
	setLayoutCollapsed,
	setLayoutHidden,
	type LayoutItemState
} from '../utils/layout.utils';

/** Which persisted array the layout lives in (`Store.widgets` / `Store.windows`). */
export type DashboardLayoutKind = 'widgets' | 'windows';

export interface UseDashboardLayoutOptions {
	/**
	 * Resolves the informational `title` Angular stores next to each entry (the rendered title
	 * text). Optional; entries keep whatever title was stored otherwise.
	 */
	getTitle?: (position: number) => string | undefined;
}

/** The layout API handed to the widget/window layouts and the Manage-widgets popover. */
export interface DashboardLayout {
	/** All items in display order (hidden ones included — the popover lists them). */
	items: LayoutItemState[];
	/** Visible items in display order. */
	visible: LayoutItemState[];
	isHidden: (position: number) => boolean;
	isAllHidden: boolean;
	/**
	 * Live readers (stable identity) — read the layout as of NOW, including a mutation made in
	 * the same tick, unlike `isHidden` / `isAllHidden` which reflect the last render. The fetch
	 * gates use these so "show window → refetch it" sees the window as visible.
	 */
	peekHidden: (position: number) => boolean;
	peekAllHidden: () => boolean;
	/** Hides one item (⋮ → Delete, auto-hide rules). No-op when already hidden. */
	hide: (position: number) => void;
	/** Shows one item. No-op when already visible. */
	show: (position: number) => void;
	/** Flips visibility (Manage-widgets checkmark rows). Returns the NEW hidden flag. */
	toggle: (position: number) => boolean;
	setCollapsed: (position: number, collapsed: boolean) => void;
	/** Reorders by display index (drag & drop). */
	move: (fromIndex: number, toIndex: number) => void;
	/** Restores the layout that preceded the last change (Manage-widgets "Undo"). */
	undo: () => void;
	canUndo: boolean;
}

/**
 * Persisted widget/window layout — the React counterpart of Angular's `WidgetService` /
 * `WindowService` + `LayoutPersistance` / `PersistanceTakers`.
 *
 * State (order, hidden, collapsed) is read from and written to `Store.widgets` / `Store.windows`
 * in the exact record shape the Angular services use, so the two dashboard flavours share one
 * layout. Every mutation snapshots the previous state (memento) and persists synchronously;
 * `undo()` pops a snapshot and persists it, like `undoDrag()`.
 *
 * @param kind `'widgets'` or `'windows'`.
 * @param count Number of items (6 for both Time Tracking layouts).
 * @param options Optional title resolver.
 */
export function useDashboardLayout(kind: DashboardLayoutKind, count: number, options: UseDashboardLayoutOptions = {}): DashboardLayout {
	const injector = useInjector();
	const store = useMemo(() => injector.get(Store), [injector]);
	const historyRef = useRef(new LayoutHistory());
	const [items, setItems] = useState<LayoutItemState[]>(() => restoreLayout(store[kind], count));
	const itemsRef = useRef(items);
	itemsRef.current = items;
	const [historyVersion, setHistoryVersion] = useState(0);
	const getTitleRef = useRef(options.getTitle);
	getTitleRef.current = options.getTitle;

	/** Writes the given layout to the store in Angular's persisted shape. */
	const persist = useCallback(
		(next: LayoutItemState[]) => {
			const serialized = serializeLayout(next, getTitleRef.current) as Partial<GuiDrag>[];
			if (kind === 'widgets') store.widgets = serialized;
			else store.windows = serialized;
		},
		[store, kind]
	);

	/** Applies a pure transition; commits + persists only when it produced a new array. */
	const commit = useCallback(
		(transition: (current: LayoutItemState[]) => LayoutItemState[]) => {
			const current = itemsRef.current;
			const next = transition(current);
			if (next === current) return;
			historyRef.current.backup(current);
			itemsRef.current = next;
			setItems(next);
			persist(next);
			setHistoryVersion((version) => version + 1);
		},
		[persist]
	);

	const hide = useCallback((position: number) => commit((current) => setLayoutHidden(current, position, true)), [commit]);
	const show = useCallback((position: number) => commit((current) => setLayoutHidden(current, position, false)), [commit]);
	const toggle = useCallback(
		(position: number) => {
			const nextHidden = !isLayoutItemHidden(itemsRef.current, position);
			commit((current) => setLayoutHidden(current, position, nextHidden));
			return nextHidden;
		},
		[commit]
	);
	const setCollapsed = useCallback(
		(position: number, collapsed: boolean) => commit((current) => setLayoutCollapsed(current, position, collapsed)),
		[commit]
	);
	const move = useCallback((from: number, to: number) => commit((current) => moveLayoutItem(current, from, to)), [commit]);
	const undo = useCallback(() => {
		const previous = historyRef.current.undo();
		if (!previous) return;
		itemsRef.current = previous;
		setItems(previous);
		persist(previous);
		setHistoryVersion((version) => version + 1);
	}, [persist]);

	const isHidden = useCallback((position: number) => isLayoutItemHidden(items, position), [items]);
	const peekHidden = useCallback((position: number) => isLayoutItemHidden(itemsRef.current, position), []);
	const peekAllHidden = useCallback(() => isLayoutAllHidden(itemsRef.current), []);
	const visible = useMemo(() => items.filter((item) => !item.hide), [items]);

	return useMemo<DashboardLayout>(
		() => ({
			items,
			visible,
			isHidden,
			isAllHidden: isLayoutAllHidden(items),
			peekHidden,
			peekAllHidden,
			hide,
			show,
			toggle,
			setCollapsed,
			move,
			undo,
			// `historyVersion` is read only so `canUndo` re-evaluates after every commit/undo.
			canUndo: historyVersion >= 0 && historyRef.current.canUndo
		}),
		[items, visible, isHidden, peekHidden, peekAllHidden, hide, show, toggle, setCollapsed, move, undo, historyVersion]
	);
}
