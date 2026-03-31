import { type ReactNode, type CSSProperties } from 'react';
import { theme } from '../../theme';

export interface CardTitleProps {
	children?: ReactNode;
	style?: CSSProperties;
	className?: string;
}

/**
 * CardTitle — primary heading text within CardHeader.
 */
export function CardTitle({ children, style, className }: CardTitleProps) {
	return (
		<h3
			className={className}
			style={{
				margin: 0,
				fontSize: '1.125rem',
				fontWeight: 600,
				lineHeight: 1.3,
				color: theme.textPrimary,
				fontFamily: theme.font,
				...style
			}}
		>
			{children}
		</h3>
	);
}
