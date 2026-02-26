const PROJECT_COLORS = ['#ffaa00', '#ff6b35', '#ffcc02', '#ff8c00', '#ffd700'];

export function ProjectDots({ count }: { count: number }) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', paddingTop: '0.125rem' }}>
			{Array.from({ length: count }, (_, i) => (
				<span
					key={i}
					style={{
						width: '0.625rem',
						height: '0.625rem',
						borderRadius: '50%',
						background: PROJECT_COLORS[i % PROJECT_COLORS.length],
						display: 'inline-block'
					}}
				/>
			))}
		</div>
	);
}
