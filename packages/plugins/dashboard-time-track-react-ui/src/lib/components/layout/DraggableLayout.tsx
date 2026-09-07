import { useCallback, useState, type DragEvent, type ReactNode } from 'react';
import { Popover } from '@gauzy/ui-react-components';
import { useTranslation } from '@gauzy/ui-react';
import { type DashboardLayout } from '../../hooks/use-dashboard-layout';
import { type LayoutItemState } from '../../utils/layout.utils';
import { NbIcon } from '../NbIcon';

/** Which of the two Angular layouts this mirrors (`ga-widget-layout` / `ga-window-layout`). */
export type DraggableLayoutKind = 'widget' | 'window';

export interface DraggableLayoutProps {
	kind: DraggableLayoutKind;
	layout: DashboardLayout;
	/**
	 * Renders the card of one item; return `null` to render nothing for it (permission-gated
	 * items). The wrapper, ⋮ menu and drag handling are added around it.
	 */
	renderItem: (item: LayoutItemState) => ReactNode;
}

const DND_MIME = 'application/x-gauzy-dashboard-item';

/**
 * The drag & drop reorder + per-item ⋮ menu shared by the widget grid and the window masonry —
 * the React counterpart of `ga-widget-layout`/`ga-widget` and `ga-window-layout`/`ga-window`.
 *
 * Reordering uses native HTML5 drag & drop (no dependency): every visible item is a drag
 * source and a drop target, and dropping item A on item B moves A to B's index in the layout
 * (`moveItemInArray` semantics, like the CDK drop lists). The ⋮ menu offers Collapse / Expand
 * / Move / Delete exactly like the Angular popover; "Move" only flags the item (`.moved`,
 * `cursor: move`) — dragging is always possible, as with `cdkDrag`.
 */
export function DraggableLayout({ kind, layout, renderItem }: DraggableLayoutProps) {
	const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
	const [overIndex, setOverIndex] = useState<number | null>(null);
	const [movingPositions, setMovingPositions] = useState<Set<number>>(() => new Set());
	const { t } = useTranslation();

	const indexOf = useCallback((position: number) => layout.items.findIndex((item) => item.position === position), [layout.items]);

	const onDragStart = useCallback(
		(event: DragEvent<HTMLDivElement>, position: number) => {
			const index = indexOf(position);
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData(DND_MIME, String(index));
			// Firefox needs some text payload to start a drag at all.
			event.dataTransfer.setData('text/plain', String(index));
			setDraggingIndex(index);
		},
		[indexOf]
	);

	const onDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>, position: number) => {
			if (draggingIndex === null) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			const index = indexOf(position);
			setOverIndex((current) => (current === index ? current : index));
		},
		[draggingIndex, indexOf]
	);

	const endDrag = useCallback(
		(position: number) => {
			setDraggingIndex(null);
			setOverIndex(null);
			setMovingPositions((current) => {
				if (!current.has(position)) return current;
				const next = new Set(current);
				next.delete(position);
				return next;
			});
		},
		[]
	);

	const onDrop = useCallback(
		(event: DragEvent<HTMLDivElement>, position: number) => {
			event.preventDefault();
			const raw = event.dataTransfer.getData(DND_MIME) || event.dataTransfer.getData('text/plain');
			const from = raw ? Number(raw) : draggingIndex;
			const to = indexOf(position);
			if (from !== null && from !== undefined && Number.isInteger(from) && to >= 0) layout.move(from, to);
			endDrag(position);
		},
		[draggingIndex, indexOf, layout, endDrag]
	);

	const setMoving = useCallback((position: number) => {
		setMovingPositions((current) => {
			const next = new Set(current);
			next.add(position);
			return next;
		});
	}, []);

	return (
		<div className={kind === 'widget' ? 'gz-rtt-widgets' : 'gz-rtt-windows'}>
			{layout.visible.map((item) => {
				const content = renderItem(item);
				if (content === null || content === undefined || content === false) return null;
				const index = indexOf(item.position);
				const classes = [
					kind === 'widget' ? 'gz-rtt-widget' : 'gz-rtt-window',
					item.isCollapse ? 'collapsed' : 'expanded',
					movingPositions.has(item.position) ? 'moved' : '',
					draggingIndex === index ? 'gz-rtt-dragging' : '',
					overIndex === index && draggingIndex !== null && draggingIndex !== index ? 'gz-rtt-drag-over' : ''
				]
					.filter(Boolean)
					.join(' ');
				return (
					<div key={item.position} className={kind === 'widget' ? 'gz-rtt-widget-drop' : 'gz-rtt-window-drop'}>
						<div
							className={classes}
							draggable
							onDragStart={(event) => onDragStart(event, item.position)}
							onDragOver={(event) => onDragOver(event, item.position)}
							onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
							onDrop={(event) => onDrop(event, item.position)}
							onDragEnd={() => endDrag(item.position)}
						>
							<span className="gz-rtt-item-menu">
								<Popover
									placement="bottom"
									content={
										<div className="gz-rtt-setting">
											<button type="button" className="gz-rtt-action" onClick={() => layout.setCollapsed(item.position, true)}>
												<i className="far fa-window-minimize" />
												<span>{t('BUTTONS.COLLAPSE')}</span>
											</button>
											<button type="button" className="gz-rtt-action" onClick={() => layout.setCollapsed(item.position, false)}>
												<i className="fas fa-expand" />
												<span>{t('BUTTONS.EXPAND')}</span>
											</button>
											<button type="button" className="gz-rtt-action" onClick={() => setMoving(item.position)}>
												<i className="fas fa-expand-arrows-alt" />
												<span>{t('BUTTONS.MOVE')}</span>
											</button>
											<button type="button" className="gz-rtt-action" onClick={() => layout.hide(item.position)}>
												<i className="fas fa-times" />
												<span>{t('BUTTONS.DELETE')}</span>
											</button>
										</div>
									}
								>
									<button type="button" className="gz-rtt-item-menu-btn" aria-label={t('BUTTONS.MANAGE_WIDGET')} draggable={false}>
										<NbIcon icon="more-vertical-outline" />
									</button>
								</Popover>
							</span>
							{content}
						</div>
					</div>
				);
			})}
		</div>
	);
}
