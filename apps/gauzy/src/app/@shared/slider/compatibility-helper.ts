// Declaration for ResizeObserver a new API available in some of newest browsers:
// https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
declare class ResizeObserver {}

/** Helper with compatibility functions to support different browsers */
export class CompatibilityHelper {
	/** Workaround for TouchEvent constructor sadly not being available on all browsers (e.g. Firefox, Safari) */
	public static isTouchEvent(event: any): boolean {
		if ((window as any).TouchEvent !== undefined) {
			return event instanceof TouchEvent;
		}

		return event.touches !== undefined;
	}

	/** Detect presence of ResizeObserver API */
	public static isResizeObserverAvailable(): boolean {
		return (window as any).ResizeObserver !== undefined;
	}
}
