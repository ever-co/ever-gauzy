import { type ReactNode } from 'react';
import { theme } from '../theme';

export interface CardProps {
	label: string;
	value: string | number;
	loading?: boolean;
	children?: ReactNode;
}

export function Card({ label, value, loading = false, children }: CardProps) {
	return (
		<div
			style={{
				background: theme.bg,
				borderRadius: theme.radius,
				boxShadow: theme.shadow,
				border: `1px solid ${theme.border}`,
				padding: '1rem 1.25rem',
				display: 'flex',
				flexDirection: 'column',
				gap: '0.375rem',
				minWidth: '140px',
				flex: '1 1 0',
				fontFamily: theme.font
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
					⋮
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
				{loading ? '—' : value}
			</div>

			{children && <div style={{ marginTop: '0.125rem' }}>{children}</div>}
		</div>
	);
}
