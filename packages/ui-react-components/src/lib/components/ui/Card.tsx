import { type ReactNode, type CSSProperties } from 'react';
import { theme } from '../../theme';

export interface CardProps {
	children?: ReactNode;
	/** 'default' = white card, 'accent' = tinted background (gauzy-card-2) */
	variant?: 'default' | 'accent';
	style?: CSSProperties;
	className?: string;
}

/**
 * Card — root layout card container (compound component).
 *
 * Compose with `<CardHeader>`, `<CardContent>`, and `<CardFooter>`.
 */
export function Card({ children, variant = 'default', style, className }: CardProps) {
	return (
		<div
			className={className}
			style={{
				background: variant === 'accent' ? theme.bgCard2 : theme.bg,
				borderRadius: theme.radius,
				boxShadow: variant === 'accent' ? theme.shadowLight : theme.shadow,
				border: `1px solid ${theme.border}`,
				fontFamily: theme.font,
				overflow: 'hidden',
				...style
			}}
		>
			{children}
		</div>
	);
}
