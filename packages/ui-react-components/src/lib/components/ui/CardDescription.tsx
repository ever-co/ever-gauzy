import { type ReactNode, type CSSProperties } from 'react';
import { theme } from '../../theme';

export interface CardDescriptionProps {
	children?: ReactNode;
	style?: CSSProperties;
	className?: string;
}

/**
 * CardDescription — helper text beneath the title for additional context.
 */
export function CardDescription({ children, style, className }: CardDescriptionProps) {
	return (
		<p
			className={className}
			style={{
				margin: 0,
				fontSize: '0.8125rem',
				color: theme.textSecondary,
				lineHeight: 1.5,
				fontFamily: theme.font,
				...style
			}}
		>
			{children}
		</p>
	);
}
