// The plugin needs only these from the kernel; the real barrel boots the whole platform.
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class CrudService {
		constructor(..._repositories: unknown[]) {}
	}
	class TenantOrganizationBaseEntity {}
	class MikroOrmBaseEntityRepository {}
	return {
		CrudService,
		TenantOrganizationBaseEntity,
		MikroOrmBaseEntityRepository,
		MultiORMEntity: decorator,
		MultiORMColumn: decorator
	};
});

import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DEFAULT_CHANGELOG_PLATFORM } from '@gauzy/contracts';
import { isChangelogPlatformKey, resolveChangelogPlatform, toChangelogPlatformKey } from './changelog-platform';
import { ChangelogQueryDTO } from './dto/changelog-query.dto';
import { ChangelogService } from './changelog.service';
import { ChangelogCreateHandler } from './commands/handlers/changelog.create.handler';
import { ChangelogUpdateHandler } from './commands/handlers/changelog.update.handler';
import { ChangelogCreateCommand, ChangelogUpdateCommand } from './commands';

describe('changelog product keys', () => {
	it('stores a key trimmed and lowercased', () => {
		expect(toChangelogPlatformKey(' Ever-Teams ')).toBe('ever-teams');
		expect(toChangelogPlatformKey(42)).toBe(42);
	});

	it.each(['gauzy', 'ever-teams', 'ever-works', 'ever-platform', 'cloc1'])('accepts %s', (key) => {
		expect(isChangelogPlatformKey(key)).toBe(true);
	});

	it.each(['', '-teams', 'teams-', 'ever--teams', 'Ever-Teams', 'ever teams', "gauzy' OR 1=1", 'x'.repeat(51), 7])(
		'refuses %p',
		(key) => {
			expect(isChangelogPlatformKey(key)).toBe(false);
		}
	);

	it('falls back when no product is named, and refuses a malformed one', () => {
		expect(resolveChangelogPlatform(undefined, DEFAULT_CHANGELOG_PLATFORM)).toBe('gauzy');
		expect(resolveChangelogPlatform('  ', DEFAULT_CHANGELOG_PLATFORM)).toBe('gauzy');
		expect(resolveChangelogPlatform(null)).toBeUndefined();
		expect(resolveChangelogPlatform('EVER-WORKS')).toBe('ever-works');
		expect(() => resolveChangelogPlatform('ever works')).toThrow(BadRequestException);
	});
});

describe('ChangelogQueryDTO platform', () => {
	const parse = async (query: Record<string, unknown>) => {
		const dto = plainToInstance(ChangelogQueryDTO, query);
		return { dto, errors: await validate(dto, { whitelist: true }) };
	};

	it('takes a product key, normalized', async () => {
		const { dto, errors } = await parse({ platform: 'Ever-Teams', isFeature: '0' });
		expect(errors).toHaveLength(0);
		expect(dto.platform).toBe('ever-teams');
		expect(dto.isFeature).toBe(false);
	});

	it('reads a blank platform as left out', async () => {
		const { dto, errors } = await parse({ platform: '' });
		expect(errors).toHaveLength(0);
		expect(dto.platform).toBeUndefined();
	});

	it('refuses a malformed platform instead of passing it to the query', async () => {
		const { errors } = await parse({ platform: "gauzy' OR '1'='1" });
		expect(errors.map((error) => error.property)).toEqual(['platform']);
	});
});

describe('ChangelogService.findAllChangelogs', () => {
	const service = () => {
		const instance = Object.create(ChangelogService.prototype) as ChangelogService;
		const findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });
		(instance as unknown as { findAll: typeof findAll }).findAll = findAll;
		return { instance, findAll };
	};

	it("lists Gauzy's entries when no product is named, as every reader before products expects", async () => {
		const { instance, findAll } = service();
		await instance.findAllChangelogs({ isFeature: false, platform: undefined } as never);
		expect(findAll).toHaveBeenCalledWith(
			expect.objectContaining({ where: { isFeature: false, platform: 'gauzy' }, take: 20 })
		);
	});

	it("lists only the named product's entries", async () => {
		const { instance, findAll } = service();
		await instance.findAllChangelogs({ platform: 'ever-teams' } as never);
		expect(findAll).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { platform: 'ever-teams' },
				order: { date: 'DESC', createdAt: 'DESC' }
			})
		);
	});
});

describe('changelog write handlers', () => {
	const changelogService = () => ({ create: jest.fn(async (input) => input) });

	it('files a new entry that names no product under Gauzy', async () => {
		const service = changelogService();
		const handler = new ChangelogCreateHandler(service as unknown as ChangelogService);
		await handler.execute(new ChangelogCreateCommand({ title: 'Hello', id: 'ignored' } as never));
		expect(service.create).toHaveBeenCalledWith({ title: 'Hello', platform: 'gauzy' });
	});

	it('files a new entry under the product it names', async () => {
		const service = changelogService();
		const handler = new ChangelogCreateHandler(service as unknown as ChangelogService);
		await handler.execute(new ChangelogCreateCommand({ title: 'Hello', platform: 'Ever-Teams' }));
		expect(service.create).toHaveBeenCalledWith({ title: 'Hello', platform: 'ever-teams' });
	});

	it('refuses a malformed product on create', async () => {
		const handler = new ChangelogCreateHandler(changelogService() as unknown as ChangelogService);
		await expect(
			handler.execute(new ChangelogCreateCommand({ title: 'Hello', platform: 'not a key' }))
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('keeps the stored product when an update leaves it out', async () => {
		const service = changelogService();
		const handler = new ChangelogUpdateHandler(service as unknown as ChangelogService);
		await handler.execute(new ChangelogUpdateCommand({ id: 'a1', title: 'Renamed' }));
		expect(service.create).toHaveBeenCalledWith({ id: 'a1', title: 'Renamed' });
	});

	it('moves an entry to the product an update names', async () => {
		const service = changelogService();
		const handler = new ChangelogUpdateHandler(service as unknown as ChangelogService);
		await handler.execute(new ChangelogUpdateCommand({ id: 'a1', platform: 'ever-works' }));
		expect(service.create).toHaveBeenCalledWith({ id: 'a1', platform: 'ever-works' });
	});
});
