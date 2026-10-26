/**
 * `uuid` ships ESM only, which Jest does not transform out of `node_modules` — a counter based stub
 * keeps the ids unique and the module graph CommonJS, exactly as `feature-flag-resolution.spec.ts` does.
 */
jest.mock('uuid', () => {
	let counter = 0;
	return { v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

/**
 * Loaded first, before the subscriber below: entering the entity graph from a subscriber leaves a decorator
 * mid-initialised. This is the same pre-import `tenant-aware-crud.service.spec.ts` opens with.
 */
import '../core/entities/internal';

import { FileStorageProviderEnum } from '@gauzy/contracts';
import { User } from '../user/user.entity';
import { UserSubscriber } from '../user/user.subscriber';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetSubscriber } from './image-asset.subscriber';
import { imageAssetUrlsReady, publishImageAssetUrls } from './image-asset-urls';

/**
 * The owner of an image (user, organization, tenant...) copies `image.fullUrl` in its load hook. It used to wait a
 * timer hop for EVERY loaded row before doing so; it now awaits the image's own URL resolution, published on the
 * asset by `ImageAssetSubscriber`, and nothing at all when there is no image.
 */
describe('imageAssetUrlsReady', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it('returns undefined when there is no asset', () => {
		expect(imageAssetUrlsReady(undefined)).toBeUndefined();
		expect(imageAssetUrlsReady(null)).toBeUndefined();
	});

	it("returns the promise published on the asset by the asset's load hook", () => {
		const asset = {};
		const ready = Promise.resolve();

		publishImageAssetUrls(asset, ready);

		expect(imageAssetUrlsReady(asset)).toBe(ready);
	});

	it('never serializes the published promise', () => {
		const asset = { url: 'a.png' };

		publishImageAssetUrls(asset, Promise.resolve());

		expect(Object.keys(asset)).toEqual(['url']);
		expect(JSON.stringify(asset)).toBe('{"url":"a.png"}');
	});

	it('returns undefined when the asset URLs are already set', () => {
		expect(imageAssetUrlsReady({ fullUrl: 'https://cdn.example.com/a.png' })).toBeUndefined();
	});

	it('otherwise falls back to a promise that resolves after one timer hop', async () => {
		jest.useFakeTimers();
		let settled = false;

		const ready = imageAssetUrlsReady({});
		expect(ready).toBeInstanceOf(Promise);
		ready.then(() => (settled = true));

		await Promise.resolve();
		expect(settled).toBe(false);

		jest.runOnlyPendingTimers();
		await ready;
		expect(settled).toBe(true);
	});
});

describe('UserSubscriber.afterEntityLoad image URL', () => {
	const subscriber = new UserSubscriber();
	let setTimeoutSpy: jest.SpyInstance;

	beforeEach(() => {
		setTimeoutSpy = jest.spyOn(global, 'setTimeout');
	});

	afterEach(() => {
		setTimeoutSpy.mockRestore();
	});

	it('copies the fullUrl of an image whose URL resolution was published, without a timer', async () => {
		const image: { fullUrl?: string } = {};
		let resolveUrls!: () => void;
		const ready = new Promise<void>((resolve) => {
			resolveUrls = () => {
				image.fullUrl = 'https://cdn.example.com/avatar.png';
				resolve();
			};
		});
		publishImageAssetUrls(image, ready);

		const user = { firstName: 'Ada', lastName: 'Lovelace', imageUrl: 'old.png', image } as unknown as User;

		const loading = subscriber.afterEntityLoad(user);
		resolveUrls();
		await loading;

		expect(user.imageUrl).toBe('https://cdn.example.com/avatar.png');
		expect(user.name).toBe('Ada Lovelace');
		expect(setTimeoutSpy).not.toHaveBeenCalled();
	});

	it('keeps the existing imageUrl and schedules no timer when image is null', async () => {
		const user = { firstName: 'Ada', imageUrl: 'kept.png', image: null } as unknown as User;

		await subscriber.afterEntityLoad(user);

		expect(user.imageUrl).toBe('kept.png');
		expect(setTimeoutSpy).not.toHaveBeenCalled();
	});

	it("copies the URL ImageAssetSubscriber resolves when the image's hook runs first (TypeORM's order)", async () => {
		const image = new ImageAsset();
		image.storageProvider = FileStorageProviderEnum.LOCAL;
		image.url = 'https://cdn.example.com/full.png';
		image.thumb = 'https://cdn.example.com/thumb.png';
		const user = { imageUrl: 'old.png', image } as unknown as User;

		// TypeORM's broadcaster calls the relation's hook before the owner's, without awaiting it in between.
		const imageLoading = new ImageAssetSubscriber().afterEntityLoad(image);
		const userLoading = subscriber.afterEntityLoad(user);
		await Promise.all([imageLoading, userLoading]);

		expect(image.fullUrl).toBe('https://cdn.example.com/full.png');
		expect(image.thumbUrl).toBe('https://cdn.example.com/thumb.png');
		expect(user.imageUrl).toBe('https://cdn.example.com/full.png');
		expect(setTimeoutSpy).not.toHaveBeenCalled();
	});

	it("still picks up the URL when the image's hook runs after the owner's (timer fallback)", async () => {
		const image: { fullUrl?: string } = {};
		const user = { imageUrl: 'old.png', image } as unknown as User;

		const loading = subscriber.afterEntityLoad(user);
		image.fullUrl = 'https://cdn.example.com/late.png';
		await loading;

		expect(user.imageUrl).toBe('https://cdn.example.com/late.png');
		expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
	});
});
