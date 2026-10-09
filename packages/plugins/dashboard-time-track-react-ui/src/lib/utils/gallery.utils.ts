import { IScreenshot, ITimeSlotStatistics } from '@gauzy/contracts';
import type { GalleryItem } from '@gauzy/ui-core/shared';

/**
 * Flattens the screenshots of every time slot into gallery items — what each `ngxGallery`
 * directive appends on init in the Angular Recent Activities window — sorted by `recordedAt`
 * per slot and stamped with the slot's `employeeId` (the gallery filters its strip by it).
 *
 * @param timeSlotEmployees Time-slot statistics grouped by employee.
 */
export function collectGalleryItems(timeSlotEmployees: ITimeSlotStatistics[] | null | undefined): GalleryItem[] {
	const items: GalleryItem[] = [];
	for (const employee of timeSlotEmployees || []) {
		for (const slot of employee.timeSlots || []) {
			// `recordedAt` may arrive as a Date or an ISO string — compare instants, not strings
			// (a `Date` stringifies to "Sat Aug 15 …", which would sort by weekday).
			const screenshots = [...(slot.screenshots || [])].sort(
				(a: IScreenshot, b: IScreenshot) => recordedAtMs(a.recordedAt) - recordedAtMs(b.recordedAt)
			);
			for (const screenshot of screenshots) {
				items.push({ ...screenshot, employeeId: slot.employeeId, thumbUrl: screenshot.thumbUrl, fullUrl: screenshot.fullUrl });
			}
		}
	}
	return items;
}

/** Epoch milliseconds of a Date / ISO string, `0` when absent or unparsable (sorts first). */
function recordedAtMs(value: Date | string | null | undefined): number {
	if (!value) return 0;
	const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
	return Number.isFinite(ms) ? ms : 0;
}
