import type { NbStatus } from '../themeTokens';

/**
 * Maps a percentage to the Nebular status Gauzy paints it with.
 *
 * A byte-for-byte mirror of `progressStatus()` in `@gauzy/ui-core/common` (kept local so this
 * package stays free of Angular/@gauzy dependencies): 0–25 danger, 26–50 warning, 51–75 info,
 * above success.
 *
 * @param value Percentage (0–100).
 */
export function progressStatus(value: number): Extract<NbStatus, 'danger' | 'warning' | 'info' | 'success'> {
	if (value <= 25) return 'danger';
	if (value <= 50) return 'warning';
	if (value <= 75) return 'info';
	return 'success';
}
