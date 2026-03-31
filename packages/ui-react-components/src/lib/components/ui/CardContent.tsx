import { type ReactNode, type CSSProperties } from 'react';
import { theme } from '../../theme';

export interface CardContentProps {
	children?: ReactNode;
	style?: CSSProperties;
	className?: string;
}

/**
 * CardContent — main card body content section.
 */
export function CardContent({ children, style, className }: CardContentProps) {
	return (
		<div
			className={className}
			style={{
				padding: '1rem 1.25rem',
				fontFamily: theme.font,
				...style
			}}
		>
			{children}
		</div>
	);
}
