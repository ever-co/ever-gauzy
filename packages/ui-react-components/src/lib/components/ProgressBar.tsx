import { type CSSProperties } from 'react';
import { progressStatus } from '../helpers/progress-status';
import { type NbStatus } from '../themeTokens';

/** Nebular progress-bar sizes; each maps to a `--progress-bar-<size>-height` token. */
export type ProgressBarSize = 'tiny' | 'small' | 'medium' | 'large' | 'giant';

export interface ProgressBarProps {
	/** Percentage 0–100 (clamped). */
	value: number;
	/** Nebular status; defaults to `progressStatus(value)` like the Gauzy dashboards. */
	status?: NbStatus;
	/** Nebular size token; defaults to `tiny`. */
	size?: ProgressBarSize;
	/** Explicit track height (overrides the size token) — Gauzy dashboards use 5px / 10px. */
	height?: string;
	/** Renders the percentage text inside the bar (Nebular `displayValue`). */
	displayValue?: boolean;
	/** Accessible name — what this percentage measures ("Project share", "Weekly activity"). */
	ariaLabel?: string;
	className?: string;
	style?: CSSProperties;
}

/**
 * ProgressBar — theme-adaptive port of `<nb-progress-bar>`.
 *
 * Track and fill colours come from the Nebular `--progress-bar-<status>-*` custom properties,
 * so the bar matches the Angular one under every theme.
 */
export function ProgressBar({
	value,
	status,
	size = 'tiny',
	height,
	displayValue = false,
	ariaLabel,
	className,
	style
}: ProgressBarProps) {
	const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
	const st = status ?? progressStatus(percent);
	return (
		<div
			className={className}
			role="progressbar"
			aria-label={ariaLabel}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			style={{
				position: 'relative',
				width: '100%',
				height: height ?? `var(--progress-bar-${size}-height)`,
				background: `var(--progress-bar-${st}-background-color)`,
				borderRadius: 'var(--progress-bar-border-radius)',
				overflow: 'hidden',
				...style
			}}
		>
			<div
				style={{
					width: `${percent}%`,
					height: '100%',
					background: `var(--progress-bar-${st}-filled-background-color)`,
					borderRadius: 'var(--progress-bar-border-radius)',
					transition: `width var(--progress-bar-animation-duration, 400ms) ease-in-out`
				}}
			/>
			{displayValue ? (
				// The label spans the WHOLE track (not the fill), so it stays legible at 0 % and small
				// values instead of being clipped inside a sliver of fill.
				<span
					aria-hidden="true"
					style={{
						position: 'absolute',
						inset: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: percent >= 50 ? `var(--progress-bar-${st}-text-color)` : 'inherit',
						fontSize: `var(--progress-bar-${size}-text-font-size)`,
						lineHeight: `var(--progress-bar-${size}-text-line-height)`,
						whiteSpace: 'nowrap',
						pointerEvents: 'none'
					}}
				>
					{`${Math.round(percent)}%`}
				</span>
			) : null}
		</div>
	);
}
