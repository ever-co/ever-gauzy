import { theme } from '../theme';

/**
 * These dots count projects; they do not identify them, so the five different
 * oranges they used to cycle through (`#ffaa00`, `#ff6b35`, `#ffcc02`,
 * `#ff8c00`, `#ffd700` — hard-coded, and therefore the same five on every
 * theme) were carrying no information at all. One accent, repeated, says the
 * same thing and matches the counter strip on the Angular tab beside it.
 */
const DEFAULT_COLORS = [theme.accent];

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
