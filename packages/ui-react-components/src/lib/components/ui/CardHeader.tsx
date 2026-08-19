import { type ReactNode, type CSSProperties } from 'react';
import { theme } from '../../theme';

export interface CardHeaderProps {
	children?: ReactNode;
	style?: CSSProperties;
	className?: string;
}

/**
 * CardHeader — organizes the card's top section.
 *
 * Typically contains `<CardTitle>`, `<CardDescription>`, and optionally `<CardAction>`.
 * Renders with padding and a bottom border separator.
 */
export function CardHeader({ children, style, className }: CardHeaderProps) {
	return (
		<div
			className={className}
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '0.375rem',
				// Matches `card-header-padding` / `card-padding` in the shared theme
				// maps, so the React panel is inset like every Angular one.
				padding: '0.875rem 1rem',
				borderBottom: `1px solid ${theme.border}`,
				fontFamily: theme.font,
				position: 'relative',
				...style
			}}
		>
			{children}
		</div>
	);
}
