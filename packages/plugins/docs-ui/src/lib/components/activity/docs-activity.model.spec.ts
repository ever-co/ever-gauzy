import { ActionTypeEnum, ActorTypeEnum, IActivityLog } from '@gauzy/contracts';
import {
	mergeActivityEntries,
	parseActivityJsonArray,
	toDocumentActivityEntry
} from './docs-activity.model';

/**
 * `Record<string, unknown>` rather than `Partial<IActivityLog>` on purpose: the json columns are
 * typed as `IActivityLogUpdatedValues[]` (an index signature of objects), and the whole point of
 * these tests is to feed the shapes the API really returns — including sqlite's serialized text.
 */
const log = (overrides: Record<string, unknown> = {}): IActivityLog =>
	({
		id: 'a1',
		action: ActionTypeEnum.Updated,
		actorType: ActorTypeEnum.User,
		createdAt: new Date('2026-01-01T10:00:00Z'),
		...overrides
	} as unknown as IActivityLog);

describe('docs-activity.model', () => {
	describe('parseActivityJsonArray', () => {
		it('reads the postgres shape (a real array) unchanged', () => {
			expect(parseActivityJsonArray([{ status: 'READY' }])).toEqual([{ status: 'READY' }]);
		});

		it('reads the sqlite shape — the column is serialized text, not json', () => {
			expect(parseActivityJsonArray('[{"status":"READY"}]')).toEqual([{ status: 'READY' }]);
		});

		it('never throws on malformed or absent values', () => {
			expect(parseActivityJsonArray('not json')).toEqual([]);
			expect(parseActivityJsonArray(undefined)).toEqual([]);
			expect(parseActivityJsonArray({ status: 'READY' })).toEqual([]);
		});
	});

	describe('toDocumentActivityEntry', () => {
		it('pairs each updated field with its before/after value', () => {
			const entry = toDocumentActivityEntry(
				log({
					updatedFields: ['status'],
					previousValues: [{ status: 'UPLOADED' }],
					updatedValues: [{ status: 'READY' }]
				})
			);

			expect(entry.changes).toHaveLength(1);
			expect(entry.changes[0]).toMatchObject({
				field: 'status',
				labelKey: 'DOCS.TABLE.COLUMNS.STATUS',
				previous: 'UPLOADED',
				next: 'READY',
				showValues: true,
				valueKeyPrefix: 'DOCS.STATUS.'
			});
		});

		it('marks a System row as system so it is not attributed to the uploader', () => {
			const entry = toDocumentActivityEntry(log({ actorType: ActorTypeEnum.System }));

			expect(entry.isSystem).toBe(true);
			expect(entry.actorName).toBe('');
		});

		it('names the author from the employee relation', () => {
			const entry = toDocumentActivityEntry(
				log({ employee: { id: 'e1', fullName: 'Ada Lovelace' } })
			);

			expect(entry.actorName).toBe('Ada Lovelace');
		});

		it('leaves an action outside ActionTypeEnum without a label key (raw enum fallback)', () => {
			const entry = toDocumentActivityEntry(log({ action: 'Teleported' as ActionTypeEnum }));

			expect(entry.action).toBe('Teleported');
			expect(entry.actionLabelKey).toBeNull();
		});

		it('leaves an unmapped column without a label key so the raw column name renders', () => {
			const entry = toDocumentActivityEntry(
				log({ updatedFields: ['somethingNew'], previousValues: [{}], updatedValues: [{}] })
			);

			expect(entry.changes[0].labelKey).toBeNull();
			expect(entry.changes[0].valueKeyPrefix).toBeNull();
		});

		it('suppresses the values of a move — a bare uuid pair tells a reader nothing', () => {
			const entry = toDocumentActivityEntry(
				log({
					updatedFields: ['parentId'],
					previousValues: [{ parentId: 'folder-a' }],
					updatedValues: [{ parentId: 'folder-b' }]
				})
			);

			expect(entry.changes[0].showValues).toBe(false);
			expect(entry.changes[0].labelKey).toBe('DOCS.DETAIL.LOCATION');
		});

		it('handles a row with no transition at all (a plain create)', () => {
			const entry = toDocumentActivityEntry(log({ action: ActionTypeEnum.Created }));

			expect(entry.changes).toEqual([]);
			expect(entry.actionLabelKey).toBe('DOCS.ACTIVITY.ACTION.CREATED');
		});
	});

	describe('mergeActivityEntries', () => {
		it('drops ids already on screen — a row written mid-session shifts the page window', () => {
			const first = [toDocumentActivityEntry(log({ id: 'a1' })), toDocumentActivityEntry(log({ id: 'a2' }))];
			const second = [toDocumentActivityEntry(log({ id: 'a2' })), toDocumentActivityEntry(log({ id: 'a3' }))];

			expect(mergeActivityEntries(first, second).map((entry) => entry.id)).toEqual(['a1', 'a2', 'a3']);
		});

		it('keeps the existing order — the timeline is newest first and pages append', () => {
			const first = [toDocumentActivityEntry(log({ id: 'a1' }))];
			const second = [toDocumentActivityEntry(log({ id: 'a0' }))];

			expect(mergeActivityEntries(first, second).map((entry) => entry.id)).toEqual(['a1', 'a0']);
		});
	});
});
