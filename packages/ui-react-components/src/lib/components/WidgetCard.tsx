import { type ReactNode } from 'react';
import { theme } from '../theme';
import { Card, CardContent } from './ui';

export interface WidgetCardProps {
	label: string;
	value: string | number;
	loading?: boolean;
	children?: ReactNode;
}

/**
 * WidgetCard — stat/widget card, built on Card + CardContent.
 *
 * Mirrors Angular's widget structure: `<nb-card><nb-card-body>...</nb-card-body></nb-card>`.
 */
export function WidgetCard({ label, value, loading = false, children }: WidgetCardProps) {
	return (
		<Card style={{ minWidth: '140px', flex: '1 1 0' }}>
			<CardContent
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '0.375rem'
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<span style={{ fontSize: '0.8125rem', color: theme.textSecondary, fontWeight: 400 }}>{label}</span>
					<span
						style={{
							color: theme.textHint,
							fontSize: '1.1rem',
							lineHeight: 1,
							paddingLeft: '0.5rem',
							cursor: 'default',
							userSelect: 'none'
						}}
					>
						&#8942;
					</span>
				</div>

				<div
					style={{
						fontSize: '1.875rem',
						fontWeight: 700,
						color: loading ? theme.textHint : theme.textPrimary,
						lineHeight: 1.1,
						letterSpacing: '-0.02em',
						minHeight: '2.2rem'
					}}
				>
					{loading ? '\u2014' : value}
				</div>

				{children && <div style={{ marginTop: '0.125rem' }}>{children}</div>}
			</CardContent>
		</Card>
	);
}
