import { SubscriptionAudienceCheck, SubscriptionCatalogue, SubscriptionCatalogueError } from './subscription-catalogue';

/**
 * The audience checks a package registers with the catalogue, so a stream that hands its events to subscribers can
 * narrow them to the subscriber's access at delivery time (the real-time channel applies them; the chat plugin
 * registers its membership check).
 */
describe('SubscriptionCatalogue audience checks', () => {
	const admitAll: SubscriptionAudienceCheck = (events) => events.map(() => true);
	const admitNone: SubscriptionAudienceCheck = (events) => events.map(() => false);

	it('narrows nothing by default', () => {
		const catalogue = new SubscriptionCatalogue();
		catalogue.declare('chat_message.created');
		expect(catalogue.audienceOf('chat_message.created')).toEqual([]);
	});

	it('keeps every check a name was given, in order, once each', () => {
		const catalogue = new SubscriptionCatalogue();
		catalogue.restrictAudience(admitAll, 'chat_message.created', 'chat_thread.changed');
		catalogue.restrictAudience(admitNone, 'chat_message.created');
		catalogue.restrictAudience(admitAll, 'chat_message.created');
		expect(catalogue.audienceOf('chat_message.created')).toEqual([admitAll, admitNone]);
		expect(catalogue.audienceOf('chat_thread.changed')).toEqual([admitAll]);
		expect(catalogue.audienceOf('task.updated')).toEqual([]);
	});

	it('answers a copy, so a reader cannot drop a check', () => {
		const catalogue = new SubscriptionCatalogue();
		catalogue.restrictAudience(admitNone, 'chat_message.created');
		(catalogue.audienceOf('chat_message.created') as SubscriptionAudienceCheck[]).length = 0;
		expect(catalogue.audienceOf('chat_message.created')).toEqual([admitNone]);
	});

	it('refuses a malformed name or a check that is not a function, and registers nothing then', () => {
		const catalogue = new SubscriptionCatalogue();
		expect(() => catalogue.restrictAudience(admitAll, 'chat_message.created', 'Not A Name')).toThrow(
			SubscriptionCatalogueError
		);
		expect(catalogue.audienceOf('chat_message.created')).toEqual([]);
		expect(() => catalogue.restrictAudience(undefined as never, 'chat_message.created')).toThrow(
			SubscriptionCatalogueError
		);
	});

	it('does not offer a name it only narrows', () => {
		const catalogue = new SubscriptionCatalogue();
		catalogue.restrictAudience(admitAll, 'chat_message.created');
		expect(catalogue.has('chat_message.created')).toBe(false);
	});
});
