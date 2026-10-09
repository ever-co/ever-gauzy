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
		<Card style={{ minWidth: '11rem', flex: '1 1 0' }}>
			<CardContent
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: '0.375rem',
					padding: '0.75rem 1rem 0.875rem'
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					{/* The KPI's NAME: a label, so it sits on the label step and stays muted. */}
					<span style={{ fontSize: '0.75rem', color: theme.textSecondary, fontWeight: 500 }}>{label}</span>
					<span
						style={{
							color: theme.textSecondary,
							fontSize: '1rem',
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
						fontSize: '1.5rem',
						fontWeight: 400,
						color: loading ? theme.textSecondary : theme.textPrimary,
						lineHeight: '2rem',
						minHeight: '2rem'
					}}
				>
					{loading ? '\u2014' : value}
				</div>

				{children && <div style={{ marginTop: '0.125rem' }}>{children}</div>}
			</CardContent>
		</Card>
	);
}
