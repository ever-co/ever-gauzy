import { theme } from '../theme';

export interface ProgressProps {
	percent: number;
	/** Fill colour. Defaults to the theme's accent. */
	color?: string;
}

export function Progress({ percent, color = theme.accent }: ProgressProps) {
	return (
		<div
			style={{
				width: '100%',
				height: '4px',
				background: theme.tint,
				borderRadius: '2px',
				overflow: 'hidden'
			}}
		>
			<div
				style={{
					width: `${Math.min(100, Math.max(0, percent))}%`,
					height: '100%',
					background: color,
					borderRadius: '2px',
					transition: 'width 0.4s ease'
				}}
			/>
		</div>
	);
}
