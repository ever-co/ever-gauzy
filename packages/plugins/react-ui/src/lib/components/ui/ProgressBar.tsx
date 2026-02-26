import { theme } from '../theme';

export function ProgressBar({ percent, color }: { percent: number; color: string }) {
	return (
		<div
			style={{
				width: '100%',
				height: '4px',
				background: theme.border,
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
