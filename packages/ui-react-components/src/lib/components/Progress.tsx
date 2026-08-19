import { theme } from '../theme';

export interface ProgressProps {
	percent: number;
	/**
	 * Fill colour. Defaults to the theme's own accent — the two callers used to
	 * pass `theme.red` and `theme.blue`, which put two unrelated saturated hues
	 * on two bars that measure the same kind of thing.
	 */
	color?: string;
}

export function Progress({ percent, color = theme.accent }: ProgressProps) {
	return (
		<div
			style={{
				width: '100%',
				height: '4px',
				// A neutral track, so the bar reads as one object rather than as two
				// colours meeting.
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
