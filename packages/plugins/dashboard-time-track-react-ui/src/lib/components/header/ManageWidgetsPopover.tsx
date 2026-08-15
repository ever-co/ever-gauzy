import { useTranslation } from '@gauzy/ui-react';
import { Popover } from '@gauzy/ui-react-components';
import { type DashboardLayout } from '../../hooks/use-dashboard-layout';
import { type LayoutItemState } from '../../utils/layout.utils';
import { NbButton } from '../NbButton';
import { NbIcon } from '../NbIcon';

export interface ManageWidgetsPopoverProps {
	widgets: DashboardLayout;
	windows: DashboardLayout;
	/** Translated title of a widget position (period-aware `titleMapper(pos, true)`). */
	widgetTitle: (position: number) => string;
	/** Translated title of a window position (`titleMapper(pos, false)`). */
	windowTitle: (position: number) => string;
	/** Fired after a widget's visibility flipped (`updateWidgetVisibility`). */
	onWidgetToggled: (item: LayoutItemState, hidden: boolean) => void;
	/** Fired after a window's visibility flipped (`updateWindowVisibility`). */
	onWindowToggled: (item: LayoutItemState, hidden: boolean) => void;
}

/**
 * The "Manage widgets ⋮" button + its popover (`#widgetManager`): "View widgets" and "View
 * windows" categories, each with an Undo button and one checkmark row per item, in display
 * order and including hidden items.
 */
export function ManageWidgetsPopover({ widgets, windows, widgetTitle, windowTitle, onWidgetToggled, onWindowToggled }: ManageWidgetsPopoverProps) {
	const { t } = useTranslation();

	const renderCategory = (
		labelKey: string,
		layout: DashboardLayout,
		titleOf: (position: number) => string,
		onToggled: (item: LayoutItemState, hidden: boolean) => void
	) => (
		<div className="gz-rtt-category">
			<div className="gz-rtt-view">
				{t(labelKey)}
				<NbButton className="gz-rtt-manage-widget gz-rtt-undo" status="basic" onClick={() => layout.undo()} disabled={!layout.canUndo}>
					<i className="fas fa-undo" />
					{t('REACT_UI.BUTTONS.UNDO')}
				</NbButton>
			</div>
			{layout.items.map((item) => (
				<button
					type="button"
					key={item.position}
					className="gz-rtt-title"
					role="menuitemcheckbox"
					aria-checked={!item.hide}
					onClick={() => onToggled(item, layout.toggle(item.position))}
				>
					<i className="fas fa-check" style={{ visibility: item.hide ? 'hidden' : 'visible' }} />
					<div>{titleOf(item.position)}</div>
				</button>
			))}
		</div>
	);

	return (
		<Popover
			placement="bottom"
			content={
				<div className="gz-rtt-widget-popover">
					{renderCategory('TIMESHEET.VIEW_WIDGETS', widgets, widgetTitle, onWidgetToggled)}
					<div className="gz-rtt-line" />
					{renderCategory('TIMESHEET.VIEW_WINDOWS', windows, windowTitle, onWindowToggled)}
				</div>
			}
		>
			<NbButton className="gz-rtt-manage-widget" size="small" status="basic" aria-haspopup="dialog">
				{t('BUTTONS.MANAGE_WIDGET')}
				<NbIcon icon="more-vertical-outline" />
			</NbButton>
		</Popover>
	);
}
