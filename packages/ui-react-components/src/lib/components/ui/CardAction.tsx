import { type ReactNode, type CSSProperties } from 'react';

export interface CardActionProps {
	children?: ReactNode;
	style?: CSSProperties;
	className?: string;
}

/**
 * CardAction — interactive elements positioned in the header's top-right corner.
 *
 * Placed inside `<CardHeader>`, rendered absolutely in the top-right.
 */
export function CardAction({ children, style, className }: CardActionProps) {
	return (
		<div
			className={className}
			style={{
				position: 'absolute',
				top: '1rem',
				right: '1.25rem',
				display: 'flex',
				alignItems: 'center',
				gap: '0.5rem',
				...style
			}}
		>
			{children}
		</div>
	);
}
