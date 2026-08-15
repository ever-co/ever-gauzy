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
			const screenshots = [...(slot.screenshots || [])].sort((a: IScreenshot, b: IScreenshot) =>
				String(a.recordedAt ?? '').localeCompare(String(b.recordedAt ?? ''))
			);
			for (const screenshot of screenshots) {
				items.push({ ...screenshot, employeeId: slot.employeeId, thumbUrl: screenshot.thumbUrl, fullUrl: screenshot.fullUrl });
			}
		}
	}
	return items;
}
