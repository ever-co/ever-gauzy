/**
 * Loaded first, before the subscriber below: entering the entity graph from a subscriber leaves a decorator
 * mid-initialised (see image-asset-urls.spec.ts).
 */
import '../../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { IssueType } from './issue-type.entity';
import { IssueTypeSubscriber } from './issue-type.subscriber';

/**
 * An issue type's image is an eager relation, so it is an own property of nearly every loaded issue type, null when
 * there is none. The load hook used to take `fullIconUrl` from the image alone whenever that property was there, so
 * an issue type without an image got no URL for its icon (classic, uploaded or any other), unlike every other task
 * property (ever-co/ever-teams#5024).
 */
describe('IssueTypeSubscriber.afterEntityLoad icon URL', () => {
	const subscriber = new IssueTypeSubscriber();
	const tenantId = randomUUID();

	const issueType = (values: Partial<IssueType>) => Object.assign(new IssueType(), values);

	it('shows the icon of an issue type whose image is null', async () => {
		const bug = issueType({ tenantId, icon: 'ever-icons/task-issue-types/bug.svg', image: null });

		await subscriber.afterEntityLoad(bug);

		expect(new URL(bug.fullIconUrl as string).pathname).toBe('/public/ever-icons/task-issue-types/bug.svg');
	});

	it('shows an uploaded icon from the provider that holds it', async () => {
		const key = `uploads/task_property_icons/${tenantId}/image-assets-1731340000-${randomUUID()}.png`;
		const story = issueType({ tenantId, icon: `image-asset:${randomUUID()}:LOCAL:${key}`, image: null });

		await subscriber.afterEntityLoad(story);

		expect(new URL(story.fullIconUrl as string).pathname).toBe(`/public/${key}`);
	});

	it('still prefers the image of an issue type that has one', async () => {
		const epic = issueType({
			tenantId,
			icon: 'ever-icons/task-issue-types/epic.svg',
			image: { fullUrl: 'https://cdn.example.com/epic.png' } as IssueType['image']
		});

		await subscriber.afterEntityLoad(epic);

		expect(epic.fullIconUrl).toBe('https://cdn.example.com/epic.png');
	});

	it('gives no URL for an icon of the Ever Teams library', async () => {
		const task = issueType({ tenantId, icon: 'hugeicons:task', image: null });

		await subscriber.afterEntityLoad(task);

		expect(task.fullIconUrl).toBeNull();
	});
});
