import { ITimeSlotStatistics } from '@gauzy/contracts';
import { collectGalleryItems } from './gallery.utils';

describe('gallery.utils — collectGalleryItems (ngxGallery appendItems parity)', () => {
	it('flattens every slot, sorts screenshots by recordedAt per slot and stamps the employeeId', () => {
		const employees = [
			{
				id: 'e1',
				timeSlots: [
					{
						id: 's1',
						employeeId: 'e1',
						screenshots: [
							{ id: 'b', thumbUrl: 'b-thumb', fullUrl: 'b-full', recordedAt: '2026-08-12T10:10:00Z' },
							{ id: 'a', thumbUrl: 'a-thumb', fullUrl: 'a-full', recordedAt: '2026-08-12T10:00:00Z' }
						]
					},
					{ id: 's2', employeeId: 'e1', screenshots: [] }
				]
			},
			{
				id: 'e2',
				timeSlots: [{ id: 's3', employeeId: 'e2', screenshots: [{ id: 'c', thumbUrl: 'c-thumb', fullUrl: 'c-full' }] }]
			}
		] as unknown as ITimeSlotStatistics[];

		const items = collectGalleryItems(employees);
		expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
		expect(items.map((item) => item.employeeId)).toEqual(['e1', 'e1', 'e2']);
		expect(items[0]).toMatchObject({ thumbUrl: 'a-thumb', fullUrl: 'a-full' });
	});

	it('copes with missing collections', () => {
		expect(collectGalleryItems(null)).toEqual([]);
		expect(collectGalleryItems([{ id: 'e' } as ITimeSlotStatistics])).toEqual([]);
		expect(collectGalleryItems([{ id: 'e', timeSlots: [{ id: 's', employeeId: 'e' }] } as unknown as ITimeSlotStatistics])).toEqual([]);
	});
});
