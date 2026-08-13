/**
 * Byte formatter shared by the upload toasts, the drop strip and the stats tiles
 * (same rounding as the detail panel). Falsy input renders as an em-dash — the
 * callers use `0` to mean "unknown", never "zero bytes".
 */
export function humanizeBytes(bytes: number): string {
	if (!bytes) return '—';
	const units = ['B', 'KB', 'MB', 'GB'];
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / Math.pow(1024, exponent);
	return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}
