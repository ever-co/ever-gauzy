const DEFAULT_COLORS = ['#ffaa00', '#ff6b35', '#ffcc02', '#ff8c00', '#ffd700'];

export interface ColorDotsProps {
	count: number;
	colors?: string[];
}

export function ColorDots({ count, colors = DEFAULT_COLORS }: ColorDotsProps) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', paddingTop: '0.125rem' }}>
			{Array.from({ length: count }, (_, i) => (
				<span
					key={i}
					style={{
						width: '0.625rem',
						height: '0.625rem',
						borderRadius: '50%',
						background: colors[i % colors.length],
						display: 'inline-block'
					}}
				/>
			))}
		</div>
	);
}
