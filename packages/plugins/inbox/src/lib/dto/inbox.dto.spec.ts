import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InboxItemKindEnum, InboxTabEnum } from '@gauzy/contracts';
import { InboxMarkAllReadDTO } from './inbox.dto';

/** `POST /inbox/items/mark-all-read` takes the list's own filters, validated as the list validates them (review F65). */
describe('InboxMarkAllReadDTO', () => {
	const errorsOf = async (body: Record<string, unknown>) =>
		(
			await validate(plainToInstance(InboxMarkAllReadDTO, body), { whitelist: true, forbidUnknownValues: false })
		).map((error) => error.property);

	it('accepts a tab and the kind, source and text filters', async () => {
		await expect(
			errorsOf({ tab: InboxTabEnum.ALL, kind: InboxItemKindEnum.NOTICE, source: 'EMAIL', q: 'invoice' })
		).resolves.toEqual([]);
		await expect(errorsOf({})).resolves.toEqual([]);
	});

	it('refuses what the list refuses', async () => {
		await expect(
			errorsOf({ tab: 'everything', kind: 'GOSSIP', source: 'x'.repeat(33), q: 'q'.repeat(201) })
		).resolves.toEqual(['tab', 'kind', 'source', 'q']);
	});
});
