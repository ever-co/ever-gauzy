import { IPagination, IUser } from '@gauzy/contracts';

/**
 * The publisher a public plugin read (`GET /plugins`, `GET /plugins/:id`, no sign-in) shows.
 *
 * The marketplace loads `uploadedBy` to show who published a plugin ("Uploaded by") and to tell the signed-in viewer
 * whether they are its publisher. The relation is the publisher's whole user row, and the read is open to anyone:
 * every visitor got the e-mail, phone number, username, time zone, last sign-in, UI preferences, role, tenant,
 * default and last team and organization, third-party id and image asset of every publisher in the registry. The
 * marketplace reads the publisher's `id` (the "is it mine" check) and `name` (the badge); the name parts and the
 * avatar (`imageUrl`) are kept with them for a plugin page that shows the publisher, and nothing else is.
 */
export const PUBLIC_PUBLISHER_FIELDS: readonly string[] = ['id', 'firstName', 'lastName', 'name', 'imageUrl'];

/** The publisher fields a public plugin read answers. */
export type IPublicPublisher = Pick<IUser, 'id' | 'firstName' | 'lastName' | 'name' | 'imageUrl'>;

/**
 * The public part of a publisher: the {@link PUBLIC_PUBLISHER_FIELDS} it carries, nothing else.
 *
 * @param publisher - The `uploadedBy` the store loaded.
 * @returns The public fields, or the value as it came when it is not a row (`null` when the plugin has none).
 */
export function publicPublisher(publisher: IUser | null | undefined): IPublicPublisher | null | undefined {
	if (!publisher || typeof publisher !== 'object') {
		return publisher;
	}
	const row = publisher as unknown as Record<string, unknown>;
	const kept: Record<string, unknown> = {};
	for (const field of PUBLIC_PUBLISHER_FIELDS) {
		if (row[field] !== undefined) {
			kept[field] = row[field];
		}
	}
	return kept as IPublicPublisher;
}

/**
 * A plugin of a public read, with its publisher reduced to the public fields. The plugin is changed in place, so the
 * entity keeps its class (and what the serializer does with it).
 *
 * @param plugin - A plugin the public read answers.
 */
export function withPublicPublisher<T>(plugin: T): T {
	if (plugin && typeof plugin === 'object' && 'uploadedBy' in plugin) {
		const read = plugin as unknown as { uploadedBy?: IUser | IPublicPublisher | null };
		read.uploadedBy = publicPublisher(read.uploadedBy as IUser);
	}
	return plugin;
}

/**
 * A page of plugins of a public read, each with its publisher reduced to the public fields.
 *
 * @param page - The page the public list read answers.
 */
export function withPublicPublishers<T extends IPagination<unknown>>(page: T): T {
	if (page && Array.isArray(page.items)) {
		page.items.forEach((plugin) => withPublicPublisher(plugin));
	}
	return page;
}
