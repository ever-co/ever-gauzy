import { type CSSProperties, type ReactNode } from 'react';
import { type NbStatus } from '../themeTokens';

export interface BadgeProps {
	/** Badge text (Nebular `[text]`). */
	text?: ReactNode;
	/** Nebular status; drives `--badge-<status>-*` colours. */
	status?: NbStatus;
	className?: string;
	style?: CSSProperties;
}

/**
 * Badge — theme-adaptive port of `<nb-badge>` in its "unpositioned" dashboard form
 * (`position: unset; display: table; margin: 10px auto 0` in the Time Tracking SCSS).
 */
export function Badge({ text, status = 'basic', className, style }: BadgeProps) {
	return (
		<span
			className={className}
			style={{
				display: 'table',
				margin: '10px auto 0',
				padding: 'var(--badge-padding)',
				borderRadius: 'var(--badge-border-radius)',
				background: `var(--badge-${status}-background-color)`,
				color: `var(--badge-${status}-text-color)`,
				fontFamily: 'var(--badge-text-font-family)',
				fontSize: 'var(--badge-text-font-size)',
				fontWeight: 'var(--badge-text-font-weight)' as CSSProperties['fontWeight'],
				lineHeight: 'var(--badge-text-line-height)',
				textAlign: 'center',
				whiteSpace: 'nowrap',
				...style
			}}
		>
			{text}
		</span>
	);
}
