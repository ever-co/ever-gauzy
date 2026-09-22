import { useMemo, type CSSProperties } from 'react';
import { progressStatus } from '../helpers/progress-status';
import { ProgressBar } from './ProgressBar';

export interface CounterPointProps {
	/** Capacity the dots represent (0 → 86400, like the Angular component). */
	total?: number;
	/** Current value; filled dots = `value / total`. */
	value?: number;
	/** Fill colour: a Nebular status name (`'success'`) or a literal CSS colour (`'#0088FE'`). */
	color?: string;
	/** Render a progress bar instead of dots (`value` is then a percentage). */
	progress?: boolean;
	className?: string;
	style?: CSSProperties;
}

/** One dot of the strip. */
interface Point {
	color: string;
}

/**
 * Computes the dot strip exactly like `gauzy-counter-point` (`packages/ui-core/shared/src/lib/counter-point`):
 * a zero capacity means one working day in seconds, anything above 24 is normalised to 24 dots,
 * and dots at or above the value are painted `basic`.
 *
 * @param total Capacity.
 * @param value Current value.
 * @param color Fill colour (status name or CSS colour); empty → status from the percentage.
 */
export function computeCounterPoints(total: number, value: number, color: string): Point[] {
	let capacity = total === 0 ? 86400 : total;
	let current = value;
	if (capacity > 24) {
		current = (current / capacity) * 24;
		capacity = 24;
	}
	const points: Point[] = [];
	for (let i = 0; i < capacity; i++) {
		points.push({
			color: i < current ? color || progressStatus((current / capacity) * 100) : 'basic'
		});
	}
	return points;
}

/**
 * Resolves the CSS background for one dot.
 *
 * Nebular status names become `var(--color-<status>-default)`; anything that already reads as a
 * CSS colour (`#0088FE`, `rgb(...)`) is used verbatim — the Angular template only handles the
 * status form, so its hex-coloured strips fall through to an invalid `var(--color-#0088FE-default)`;
 * this port paints the colour the caller asked for.
 *
 * @param color Point colour.
 */
export function counterPointBackground(color: string): string {
	if (color === 'basic') return 'var(--progress-bar-danger-background-color)';
	if (/^(#|rgb|hsl|var\()/i.test(color)) return color;
	return `var(--color-${color}-default)`;
}

/**
 * CounterPoint — React port of `<gauzy-counter-point>`: a strip of up to 24 pill-shaped dots
 * (10px high, 3px apart) or, with `progress`, a 10px Nebular progress bar.
 */
export function CounterPoint({ total, value = 0, color = '', progress = false, className, style }: CounterPointProps) {
	// An UNKNOWN capacity (`total` undefined — the employees/projects count not loaded yet, or a
	// user without the permission to read it) paints no dots at all, exactly like the Angular
	// `gauzy-counter-point` (`for (i < undefined)` iterates zero times); `0` means "a day".
	const points = useMemo(
		() => (progress || total === undefined ? [] : computeCounterPoints(total, value, color)),
		[progress, total, value, color]
	);

	if (progress) {
		return (
			<div className={className} style={style}>
				<ProgressBar value={value} height="10px" />
			</div>
		);
	}

	return (
		<div
			className={className}
			style={{
				display: 'flex',
				flexDirection: 'row',
				width: '100%',
				height: '10px',
				justifyContent: 'space-between',
				...style
			}}
		>
			{points.map((point, index) => (
				<div
					key={index}
					className={`gzrc-counter-point ${point.color === 'basic' ? 'basic' : 'filled'}`}
					style={{
						width: '100%',
						height: '10px',
						borderRadius: '5px',
						marginInlineEnd: '3px',
						background: counterPointBackground(point.color)
					}}
				/>
			))}
		</div>
	);
}
