import { type ReactNode, type CSSProperties } from 'react';
import { theme } from '../../theme';

export interface CardFooterProps {
	children?: ReactNode;
	style?: CSSProperties;
	className?: string;
}

/**
 * CardFooter — secondary actions and footer content at the card's bottom.
 */
export function CardFooter({ children, style, className }: CardFooterProps) {
	return (
		<div
			className={className}
			style={{
				display: 'flex',
				alignItems: 'center',
				padding: '1rem 1.25rem',
				borderTop: `1px solid ${theme.border}`,
				fontFamily: theme.font,
				...style
			}}
		>
			{children}
		</div>
	);
}
