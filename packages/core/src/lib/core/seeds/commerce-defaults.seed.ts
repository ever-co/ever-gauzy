import { DataSource } from 'typeorm';
import { IOrganization } from '@gauzy/contracts';
import { ChannelStatus, SequenceResetPolicy } from '@gauzy/contracts';
import { Channel } from '../../channel/channel.entity';
import { Region } from '../../region/region.entity';
import { Sequence } from '../../sequence/sequence.entity';

/**
 * The defaults an organization needs before it can issue a single document.
 *
 * ## Why this runs at boot rather than only in a migration
 *
 * `1791000000520-SeedCoreDefaults` seeds a default channel, a default region and the seven numbering
 * series **for every organization that exists when it runs**. On an installation that is being upgraded
 * that is exactly right: the organizations are already there. On a fresh installation it seeds nothing
 * at all, because the organization is created *after* the migrations by this application's own seeding —
 * and then nothing ever re-runs it. The consequence is not a cosmetic one: a numbering series is what a
 * document is quoted by, so a fresh installation could create parties, suppliers, warehouses, products
 * and payment accounts, and then fail to raise a purchase order at all, with
 * `PURCHASE_ORDER_SEQUENCE_MISSING` naming a series nobody had created. The default channel and region
 * are missing with it, which is what a request is resolved against.
 *
 * So the same defaults are ensured here, at the moment the organization exists, and the two places
 * write the same rows: the migration for the organizations a migration finds, and this for the
 * organization an installation creates afterwards. **They must agree**, which is why the values below
 * are the migration's own — the same seven keys, the same prefixes, the same padding — and why each
 * insert is guarded by the existence of the row it would create rather than by whether this function has
 * run before.
 *
 * ## Idempotence
 *
 * Every step is "create it if it is not there", checked against the row's own uniqueness — the series by
 * `(organizationId, key, channelId IS NULL)`, the channel and the region by `(organizationId, code)` —
 * so a boot that runs this again creates nothing, and an operator who renamed their default channel does
 * not get a second one. That matters more than it looks: a second `ORDER` series would restart numbering
 * from one and two documents would carry the same number.
 *
 * @param dataSource The connection the seeding runs on.
 * @param organizations The organizations to seed for, as the caller created them.
 */
export async function createDefaultCommerceDefaults(
	dataSource: DataSource,
	organizations: IOrganization[]
): Promise<void> {
	if (!organizations?.length) {
		return;
	}

	for (const organization of organizations) {
		if (!organization?.id) {
			continue;
		}

		const channel = await ensureDefaultChannel(dataSource, organization);

		if (channel) {
			await ensureDefaultRegion(dataSource, organization, channel);
			await ensureSequences(dataSource, organization, channel);
		}
	}
}

/**
 * The numbering series every organization needs before it can issue a document, in the wording the
 * data-only kernel migration uses.
 *
 * The `ORDER` series takes its prefix and padding from the organization's default channel, because an
 * order number is the one document identifier a tenant configures per sales surface; every other series
 * carries its own prefix.
 */
const SEQUENCE_SERIES: ReadonlyArray<{ key: string; prefix: string }> = [
	{ key: 'ORDER', prefix: 'SO-' },
	{ key: 'RETURN', prefix: 'RT-' },
	{ key: 'CLAIM', prefix: 'CL-' },
	{ key: 'EXCHANGE', prefix: 'EX-' },
	{ key: 'PO', prefix: 'PO-' },
	{ key: 'SUBSCRIPTION', prefix: 'SUB-' },
	{ key: 'ENTITLEMENT', prefix: 'EN-' }
];

/** The code, name and prefix the default channel is created with, and the padding its numbers use. */
const DEFAULT_CHANNEL = { code: 'DEFAULT', name: 'Default channel', orderPrefix: 'SO-', padding: 6 };

/** The code and name the default region is created with. */
const DEFAULT_REGION = { code: 'DEFAULT', name: 'Default region' };

/**
 * Ensures the organization's default channel.
 *
 * @param dataSource The connection the seeding runs on.
 * @param organization The organization to seed for.
 * @returns The existing or newly created channel, or undefined when it could not be read or written.
 */
async function ensureDefaultChannel(dataSource: DataSource, organization: IOrganization): Promise<Channel | undefined> {
	const repository = dataSource.getRepository(Channel);

	const existing = await repository.findOne({
		where: { organizationId: organization.id, code: DEFAULT_CHANNEL.code } as never
	});

	if (existing) {
		return existing;
	}

	const created = repository.create({
		tenantId: organization.tenantId,
		organizationId: organization.id,
		name: DEFAULT_CHANNEL.name,
		code: DEFAULT_CHANNEL.code,
		status: ChannelStatus.ACTIVE,
		isDefault: true,
		defaultCurrency: organization.currency,
		orderNumberPrefix: DEFAULT_CHANNEL.orderPrefix,
		orderNumberPadding: DEFAULT_CHANNEL.padding
	} as Partial<Channel>);

	return await repository.save(created);
}

/**
 * Ensures the organization's default region, which carries the default channel's currency.
 *
 * @param dataSource The connection the seeding runs on.
 * @param organization The organization to seed for.
 * @param channel The organization's default channel.
 */
async function ensureDefaultRegion(
	dataSource: DataSource,
	organization: IOrganization,
	channel: Channel
): Promise<void> {
	const repository = dataSource.getRepository(Region);

	const existing = await repository.findOne({
		where: { organizationId: organization.id, code: DEFAULT_REGION.code } as never
	});

	if (existing) {
		return;
	}

	const created = repository.create({
		tenantId: channel.tenantId ?? organization.tenantId,
		organizationId: channel.organizationId ?? organization.id,
		name: DEFAULT_REGION.name,
		code: DEFAULT_REGION.code,
		currency: channel.defaultCurrency ?? organization.currency,
		isDefault: true,
		isTaxInclusive: false,
		status: ChannelStatus.ACTIVE
	} as Partial<Region>);

	await repository.save(created);
}

/**
 * Ensures the seven numbering series, one set per organization, each guarded by its own key.
 *
 * @param dataSource The connection the seeding runs on.
 * @param organization The organization to seed for.
 * @param channel The organization's default channel, whose prefix the ORDER series takes.
 */
async function ensureSequences(dataSource: DataSource, organization: IOrganization, channel: Channel): Promise<void> {
	const repository = dataSource.getRepository(Sequence);

	const existing = await repository.find({ where: { organizationId: organization.id } as never });
	const keys = new Set(existing.map((row) => row.key));

	for (const series of SEQUENCE_SERIES) {
		if (keys.has(series.key)) {
			continue;
		}

		const created = repository.create({
			tenantId: channel.tenantId ?? organization.tenantId,
			organizationId: channel.organizationId ?? organization.id,
			key: series.key,
			prefix: series.key === 'ORDER' ? channel.orderNumberPrefix ?? series.prefix : series.prefix,
			padding: channel.orderNumberPadding ?? DEFAULT_CHANNEL.padding,
			nextValue: 1,
			step: 1,
			resetPolicy: SequenceResetPolicy.NEVER
		} as Partial<Sequence>);

		await repository.save(created);
	}
}
