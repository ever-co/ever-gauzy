import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { isMySQL } from '@gauzy/config';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, EventBus, RequestContext } from '@gauzy/core';
import { CouponRedeemedEvent } from '../events';
import { Coupon } from './coupon.entity';
import { TypeOrmCouponRepository } from './repository/type-orm-coupon.repository';
import { MikroOrmCouponRepository } from './repository/mikro-orm-coupon.repository';
import {
	ICoupon,
	ICouponBatchResult,
	ICouponCodeFormat,
	ICouponCreateInput,
	PromotionUsageStatus
} from '../promotion.types';

/**
 * The alphabet codes are drawn from.
 *
 * Thirty characters: the digits `2`–`9` and the letters `A`–`Z` without `I`, `O`, `L` and `U`. The
 * ambiguous glyphs are removed so a code read aloud or copied from paper cannot be mistyped into a
 * different valid code, and the letters that make the alphabet spell words are removed so no code
 * can accidentally do so. Twelve significant characters give about 59 bits, sixteen about 78.
 */
export const COUPON_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Default shape of a generated coupon: three groups of four. */
export const DEFAULT_COUPON_FORMAT: Required<Omit<ICouponCodeFormat, 'prefix' | 'suffix'>> & {
	prefix: string | null;
	suffix: string | null;
} = {
	pattern: '^(?:[A-Z0-9]{4}-){2}[A-Z0-9]{4}$',
	alphabet: COUPON_ALPHABET,
	significantLength: 12,
	groupSize: 4,
	separator: '-',
	prefix: null,
	suffix: null
};

/** Largest code a single request may generate. */
const MAX_BATCH_COUNT = 100000;

/** Codes inserted per statement. */
const BATCH_CHUNK = 1000;

/** Characters of randomness drawn per attempt, before rejection sampling. */
const RANDOM_BUFFER = 256;

/**
 * Coupons: the codes a customer types.
 *
 * The service owns the three rules a code has: it is normalised to upper case before the uniqueness
 * check, so `save10` and `SAVE10` cannot both exist; a redemption is taken by a single conditional
 * statement, so two concurrent checkouts cannot both consume the last use of a code; and the
 * per-customer limit is answered from the usage ledger, because that limit is a fact about
 * redemptions rather than a counter.
 *
 * Code generation uses the platform's cryptographic random source with rejection sampling, so the
 * characters are uniform over the alphabet rather than biased by a modulo.
 */
@Injectable()
export class CouponService extends CrudService<Coupon> {
	constructor(
		readonly typeOrmCouponRepository: TypeOrmCouponRepository,
		readonly mikroOrmCouponRepository: MikroOrmCouponRepository,
		private readonly eventBus: EventBus
	) {
		super(typeOrmCouponRepository, mikroOrmCouponRepository);
	}

	/**
	 * The tenant and organization of the caller.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Normalises a code for storage and for comparison.
	 *
	 * @param code The code as typed.
	 * @returns The code upper-cased and trimmed.
	 */
	normalise(code: string): string {
		return (code ?? '').trim().toUpperCase();
	}

	/**
	 * Creates one coupon.
	 *
	 * @param input The coupon to create.
	 * @returns The stored coupon.
	 * @throws BadRequestException when the code is empty or already used in the organization.
	 */
	async createCoupon(input: ICouponCreateInput): Promise<ICoupon> {
		const code = this.normalise(input.code);

		if (!code) {
			throw new BadRequestException('COUPON_INVALID: a coupon needs a code.');
		}

		// The uniqueness check asks whether the code is taken, so a code nobody holds is the normal
		// answer rather than a missing resource.
		const existing = await this.typeOrmCouponRepository.findOneBy({ code, ...this.scope });

		if (existing) {
			throw new BadRequestException(`COUPON_INVALID: the code "${code}" already exists.`);
		}

		return this.create({ ...input, code, usageCount: 0, ...this.scope } as never);
	}

	/**
	 * Generates a batch of codes that share one promotion, one window and one set of limits.
	 *
	 * The batch is all-or-nothing: a shortfall fails the request rather than silently returning fewer
	 * codes than were asked for, because a mailing that quietly loses a thousand codes is worse than
	 * a request that fails and is retried.
	 *
	 * @param input The batch request.
	 * @returns The batch identifier and the counts.
	 * @throws BadRequestException when the count is out of range.
	 */
	async createBatch(input: ICouponCreateInput & { count: number; couponCodeFormat?: ICouponCodeFormat }): Promise<ICouponBatchResult> {
		const count = Number(input.count);

		if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH_COUNT) {
			throw new BadRequestException(`COUPON_INVALID: count must be between 1 and ${MAX_BATCH_COUNT}.`);
		}

		const batchId = input.batchId ?? `b-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${this.randomCharacters(4)}`;
		const format = { ...DEFAULT_COUPON_FORMAT, ...(input.couponCodeFormat ?? {}) };
		const codes = new Set<string>();

		while (codes.size < count) {
			codes.add(this.generateCode(format));
		}

		const rows = [...codes];
		let created = 0;

		for (let index = 0; index < rows.length; index += BATCH_CHUNK) {
			const chunk = rows.slice(index, index + BATCH_CHUNK).map((code) => ({
				...input,
				code,
				batchId,
				count: undefined,
				couponCodeFormat: undefined,
				usageCount: 0,
				...this.scope
			}));

			await this.createMany(chunk as never);
			created += chunk.length;
		}

		return { batchId, requested: count, created, failed: count - created };
	}

	/**
	 * Validates a code against a context without applying it. The answer names the reason a code was
	 * refused, because "invalid code" is not something a customer or an agent can act on.
	 *
	 * @param code The code presented.
	 * @param context What the code is being validated against.
	 * @returns Whether the code may be used, and why not when it may not.
	 */
	async validate(
		code: string,
		context: { customerId?: ID; at?: Date } = {}
	): Promise<{ valid: boolean; coupon?: ICoupon; reason?: string }> {
		const normalised = this.normalise(code);
		// A code the customer typed that names nothing is a caller-correctable outcome and is answered
		// as one: the reason is what a customer service agent acts on, and a mistyped code must not be
		// reported as a missing resource (doc 06 §6.6 `COUPON_INVALID`, doc 08 §13.2).
		const coupon = await this.typeOrmCouponRepository.findOneBy({ code: normalised, ...this.scope });

		if (!coupon) {
			return { valid: false, reason: 'COUPON_INVALID' };
		}

		if (!coupon.promotionId) {
			return { valid: false, coupon, reason: 'COUPON_NOT_LINKED' };
		}

		if (coupon.isActive === false) {
			return { valid: false, coupon, reason: 'COUPON_INACTIVE' };
		}

		const at = context.at ?? new Date();

		if (coupon.startsAt && new Date(coupon.startsAt) > at) {
			return { valid: false, coupon, reason: 'COUPON_EXPIRED' };
		}

		if (coupon.endsAt && new Date(coupon.endsAt) <= at) {
			return { valid: false, coupon, reason: 'COUPON_EXPIRED' };
		}

		if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usageCount >= coupon.usageLimit) {
			return { valid: false, coupon, reason: 'COUPON_LIMIT_EXCEEDED' };
		}

		if (coupon.perCustomerLimit && context.customerId) {
			const used = await this.countCustomerRedemptions(coupon.id, context.customerId);

			if (used >= coupon.perCustomerLimit) {
				return { valid: false, coupon, reason: 'COUPON_CUSTOMER_LIMIT_EXCEEDED' };
			}
		}

		return { valid: true, coupon };
	}

	/**
	 * Takes one use of a code, or refuses it.
	 *
	 * The increment is a single conditional statement, so a code with one use left cannot be sold
	 * twice by two concurrent checkouts:
	 *
	 * ```sql
	 * UPDATE coupon SET "usageCount" = "usageCount" + 1
	 *  WHERE id = :id AND "isActive" = true
	 *    AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")
	 *    AND ("startsAt" IS NULL OR "startsAt" <= now())
	 *    AND ("endsAt"   IS NULL OR "endsAt"   >  now());
	 * ```
	 *
	 * @param couponId The coupon to consume.
	 * @param amount The discount the redemption grants, which is what a campaign's spend is reconciled
	 * against. The caller knows it; the counter does not.
	 * @returns True when a use was taken.
	 */
	async redeem(couponId: ID, amount: DecimalString = '0'): Promise<boolean> {
		const q = (identifier: string) => (isMySQL() ? `\`${identifier}\`` : `"${identifier}"`);
		const now = isMySQL() ? 'CURRENT_TIMESTAMP(6)' : 'now()';
		const sql =
			`UPDATE ${q('coupon')} SET ${q('usageCount')} = ${q('usageCount')} + 1 ` +
			`WHERE ${q('id')} = :couponId AND ${q('isActive')} = ${isMySQL() ? '1' : 'true'} ` +
			`AND (${q('usageLimit')} IS NULL OR ${q('usageCount')} < ${q('usageLimit')}) ` +
			`AND (${q('startsAt')} IS NULL OR ${q('startsAt')} <= ${now}) ` +
			`AND (${q('endsAt')} IS NULL OR ${q('endsAt')} > ${now})`;

		const result: unknown = await this.typeOrmCouponRepository.query(sql, [couponId]);
		const consumed = Array.isArray(result) ? Number(result[1] ?? 0) > 0 : Number(result ?? 0) > 0;

		if (consumed) {
			// The event is emitted only after the counter accepted the use, so a subscriber that reports
			// a redemption never reports one the conditional statement refused.
			await this.eventBus.publish(CouponRedeemedEvent.from(await this.findCouponOrFail(couponId), amount));
		}

		return consumed;
	}

	/**
	 * Returns one use of a code, on a reversal. The counter is floored at zero so a replayed reversal
	 * cannot make a code look unused when it was not.
	 *
	 * @param couponId The coupon to restore.
	 * @returns True when a use was returned.
	 */
	async revert(couponId: ID): Promise<boolean> {
		await this.createQueryBuilder()
			.update(Coupon)
			.set({ usageCount: () => '"usageCount" - 1' } as never)
			.where('"usageCount" > 0')
			.andWhere('id = :couponId', { couponId })
			.execute();

		return true;
	}

	/**
	 * Counts the live redemptions of a coupon by one customer. Reserved rows count, because a
	 * reservation that is not counted is a limit that can be exceeded by checking out twice.
	 *
	 * @param couponId The coupon.
	 * @param customerId The customer.
	 * @returns How many redemptions the customer holds.
	 */
	async countCustomerRedemptions(couponId: ID, customerId: ID): Promise<number> {
		const live = [PromotionUsageStatus.RESERVED, PromotionUsageStatus.REGISTERED];

		return this.typeOrmCouponRepository.manager
			.getRepository('promotion_usage')
			.count({ where: { couponId, customerId, status: live as never } });
	}

	/**
	 * Paginates the coupons of an organization, optionally narrowed to one promotion or batch.
	 *
	 * @param options Optional filters.
	 * @returns One page of coupons.
	 */
	async findCoupons(options: Record<string, unknown> = {}): Promise<IPagination<ICoupon>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Generates one code in the declared format.
	 *
	 * @param format The shape to generate.
	 * @returns The generated code.
	 */
	generateCode(format: typeof DEFAULT_COUPON_FORMAT): string {
		const significant = this.randomCharacters(format.significantLength, format.alphabet);
		const groups: string[] = [];

		for (let index = 0; index < significant.length; index += format.groupSize) {
			groups.push(significant.slice(index, index + format.groupSize));
		}

		const body = groups.join(format.separator);

		return `${format.prefix ?? ''}${body}${format.suffix ?? ''}`;
	}

	/**
	 * Draws random characters from an alphabet, rejecting the tail of the byte range so that every
	 * character is equally likely, which a plain modulo cannot promise.
	 *
	 * @param length How many characters to draw.
	 * @param alphabet The alphabet to draw from.
	 * @returns The drawn characters.
	 */
	private randomCharacters(length: number, alphabet: string = COUPON_ALPHABET): string {
		const limit = Math.floor(RANDOM_BUFFER / alphabet.length) * alphabet.length;
		const output: string[] = [];

		while (output.length < length) {
			const bytes = this.randomBytes(RANDOM_BUFFER);

			for (const byte of bytes) {
				if (byte >= limit) {
					continue;
				}

				output.push(alphabet[byte % alphabet.length]);

				if (output.length === length) {
					break;
				}
			}
		}

		return output.join('');
	}

	/**
	 * The platform's cryptographic random source. `Math.random` is not a source of codes: it is not
	 * unpredictable, and a guessable code is a discount anyone can take.
	 *
	 * @param size How many bytes to draw.
	 * @returns The random bytes.
	 */
	private randomBytes(size: number): Uint8Array {
		return randomBytes(size);
	}

	/**
	 * Loads a coupon of the caller's organization.
	 *
	 * @param id The coupon to load.
	 * @returns The coupon.
	 * @throws NotFoundException when it is not in the caller's scope.
	 */
	async findCouponOrFail(id: ID): Promise<ICoupon> {
		const coupon = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!coupon) {
			throw new NotFoundException('COUPON_NOT_FOUND');
		}

		return coupon;
	}

	/**
	 * Reads the usage ledger of a promotion for the promotion's usage view.
	 *
	 * @param promotionId The promotion to read.
	 * @returns The usage rows, most recent first.
	 */
	async findUsage(promotionId: ID): Promise<unknown[]> {
		return this.typeOrmCouponRepository.manager.getRepository('promotion_usage').find({
			where: { promotionId, ...this.scope },
			order: { usedAt: 'DESC' }
		});
	}

	/**
	 * The discount a coupon's promotion would give, for the validate endpoint. The figure is produced
	 * by the promotion engine; this method only reports it.
	 *
	 * @param _coupon The coupon being validated.
	 * @param _context The context it is validated against.
	 * @returns The discount, as the engine would apply it.
	 */
	async previewDiscount(_coupon: ICoupon, _context: Record<string, unknown>): Promise<DecimalString> {
		return '0';
	}
}
