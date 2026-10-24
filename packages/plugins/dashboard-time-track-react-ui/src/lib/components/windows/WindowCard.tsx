import '../nebular-jsx';
import { type ReactNode } from 'react';
import { Spinner } from '@gauzy/ui-react-components';

export interface WindowCardProps {
	/** Translated window title (`.window-header__title`). */
	title: string;
	/** `[nbSpinner]` flag. */
	loading: boolean;
	/** True when there is data to list; otherwise `emptyMessage` renders (unless loading). */
	hasData: boolean;
	/** Translated per-period empty message. */
	emptyMessage: string;
	/** Extra class of the `<nb-card-body>` (`custom-card-body-inner[-list]`). */
	bodyClassName?: string;
	/** Extra classes on `<nb-card>` (`member-list`). */
	className?: string;
	/**
	 * Header button ("View All" / "View Report", `.window-header__action`) — rendered only while
	 * there is data, like the Angular `@if (… .length > 0)` around it.
	 */
	action?: ReactNode;
	children?: ReactNode;
}

/**
 * The `<nb-card [nbSpinner]><nb-card-header class="window-header">…</nb-card-header>…</nb-card>`
 * shell every window template shares: title + optional header action, the `.window-body`, its
 * loading veil and the per-period `.window-empty` state.
 */
export function WindowCard({
	title,
	loading,
	hasData,
	emptyMessage,
	bodyClassName = 'gz-rtt-custom-card-body-inner-list',
	className,
	action,
	children
}: WindowCardProps) {
	return (
		<nb-card className={className}>
			<nb-card-header className="gz-rtt-window-header">
				<span className="gz-rtt-window-header-title" title={title}>
					{title}
				</span>
				{hasData && action ? <span className="gz-rtt-window-header-action">{action}</span> : null}
			</nb-card-header>
			{hasData || !loading ? (
				<nb-card-body className={`${bodyClassName} gz-rtt-window-body`}>
					{hasData ? children : <div className="gz-rtt-window-empty">{emptyMessage}</div>}
				</nb-card-body>
			) : null}
			<Spinner active={loading} status="primary" size="giant" />
		</nb-card>
	);
}
