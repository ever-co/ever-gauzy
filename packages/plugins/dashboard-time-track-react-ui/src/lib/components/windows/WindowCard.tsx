import '../nebular-jsx';
import { type ReactNode } from 'react';
import { Spinner } from '@gauzy/ui-react-components';

export interface WindowCardProps {
	/** Translated window title (`<nb-card-header>`). */
	title: string;
	/** `[nbSpinner]` flag. */
	loading: boolean;
	/** True when there is data to list; otherwise `emptyMessage` renders (unless loading). */
	hasData: boolean;
	/** Translated per-period empty message. */
	emptyMessage: string;
	/** Class of the `<nb-card-body>` when there is data (`custom-card-body-inner[-list]`). */
	bodyClassName?: string;
	/** Extra classes on `<nb-card>` (`member-list`). */
	className?: string;
	/** Adds the flex `nb-card-header` variant (`class="nb-card-header"`). */
	flexHeader?: boolean;
	/**
	 * Where the empty message goes: inside the body (Recent activities / Members) or as a
	 * sibling of the header (Manual time / Tasks / Projects / Apps), like the Angular templates.
	 */
	emptyInBody?: boolean;
	children?: ReactNode;
}

/**
 * The `<nb-card [nbSpinner]><nb-card-header>…</nb-card-header>…</nb-card>` shell every window
 * template shares, including its loading veil and per-period empty state.
 */
export function WindowCard({
	title,
	loading,
	hasData,
	emptyMessage,
	bodyClassName = 'gz-rtt-custom-card-body-inner-list',
	className,
	flexHeader = false,
	emptyInBody = false,
	children
}: WindowCardProps) {
	const empty = !hasData && !loading ? <div className="gz-rtt-empty gz-rtt-p-3">{emptyMessage}</div> : null;
	return (
		<nb-card className={className}>
			<nb-card-header className={flexHeader ? 'gz-rtt-nb-card-header' : undefined}>{title}</nb-card-header>
			{hasData ? <nb-card-body className={bodyClassName}>{children}</nb-card-body> : null}
			{!hasData && emptyInBody ? <nb-card-body className={bodyClassName}>{empty}</nb-card-body> : null}
			{!hasData && !emptyInBody ? empty : null}
			<Spinner active={loading} status="primary" size="giant" />
		</nb-card>
	);
}
