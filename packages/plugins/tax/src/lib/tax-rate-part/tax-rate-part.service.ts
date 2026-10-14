import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, DeleteResult, FindManyOptions, FindOptionsWhere, In } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, addDecimalStrings, compareDecimalStrings } from '@gauzy/core';
import { TaxAmountType, TaxPartType, TaxWriteInput } from '../tax.types';
import { TaxRatePart } from './tax-rate-part.entity';
import { MikroOrmTaxRatePartRepository } from './repository/mikro-orm-tax-rate-part.repository';
import { TypeOrmTaxRatePartRepository } from './repository/type-orm-tax-rate-part.repository';

/**
 * The ordered parts a rate is made of.
 *
 * A part is not an independent resource: it exists only as one element of an ordered list on a rate, it
 * has no lifecycle of its own, and it is edited by the same person in the same form as the rate. The
 * service therefore exposes the list of one rate and the replacement of that list, and the routes that
 * reach it are the rate's (`/tax-rates/:id/parts`) under the rate's editing permission. A separate
 * permission would let a role reshape the arithmetic of a rate it may not create.
 *
 * What the service refuses, and why each refusal is a real defect rather than a preference:
 *
 * - a part whose `factorPercent` is zero carries none of the rate and is not a part;
 * - a part whose `baseFactor` is not positive would make the base of a tax zero or negative;
 * - a `FIXED` part without an amount, or a currency, states no tax at all, and a `PERCENT` part that
 *   states a fixed amount says two contradictory things;
 * - the positive shares of a rate's `TAX` parts must sum to nothing or to the whole, and the negative
 *   shares to nothing or to the whole of a negative side, because a breakdown that sums to 80 % silently
 *   collects four fifths of the tax the rate declares.
 */
@Injectable()
export class TaxRatePartService extends TenantAwareCrudService<TaxRatePart> {
	constructor(
		readonly typeOrmTaxRatePartRepository: TypeOrmTaxRatePartRepository,
		readonly mikroOrmTaxRatePartRepository: MikroOrmTaxRatePartRepository
	) {
		super(typeOrmTaxRatePartRepository, mikroOrmTaxRatePartRepository);
	}

	/**
	 * Retrieves a paginated list of parts.
	 *
	 * @param filter Optional filtering criteria.
	 * @returns A paginated list of parts.
	 */
	public async findAll(filter?: FindManyOptions<TaxRatePart>): Promise<IPagination<TaxRatePart>> {
		return await this.paginate(filter);
	}

	/**
	 * Reads the parts of one rate, in the order they are applied.
	 *
	 * @param taxRateId The rate to read.
	 * @returns The parts, ordered by their sequence.
	 */
	public async listForRate(taxRateId: ID): Promise<TaxRatePart[]> {
		return await this.typeOrmTaxRatePartRepository.find({
			where: { taxRateId, organizationId: RequestContext.currentOrganizationId() },
			order: { sequence: 'ASC' }
		});
	}

	/**
	 * Reads the parts of several rates at once.
	 *
	 * The resolution reads a whole chain in one query rather than one query per rate: a chain is a handful
	 * of rates and the parts of all of them are needed before any amount is computed.
	 *
	 * @param taxRateIds The rates to read.
	 * @returns Every part of every named rate, ordered by rate and then by sequence.
	 */
	public async listForRates(taxRateIds: ID[]): Promise<TaxRatePart[]> {
		if (!taxRateIds.length) {
			return [];
		}

		return await this.typeOrmTaxRatePartRepository.find({
			where: {
				taxRateId: In(taxRateIds),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { taxRateId: 'ASC', sequence: 'ASC' }
		});
	}

	/**
	 * Replaces the parts of one rate with the supplied ordered list.
	 *
	 * The list is written as a set: the parts the rate no longer carries are soft-deleted and the supplied
	 * ones are inserted, all inside one transaction, so a reader never sees a rate with half of one
	 * breakdown and half of another. The removed rows are kept rather than dropped, because a `tax_line`
	 * written under the old breakdown names its part and a placed document's evidence has to stay
	 * explainable.
	 *
	 * An empty list is a legitimate write: it returns the rate to the one implied part it had before any
	 * part existed, which is exactly what an operator wants when a split turns out to be wrong.
	 *
	 * @param taxRateId The rate whose parts are being written.
	 * @param parts The complete ordered list the rate should carry.
	 * @returns The parts after the write.
	 * @throws BadRequestException when the list is not a usable breakdown.
	 */
	public async replaceForRate(taxRateId: ID, parts: TaxWriteInput<TaxRatePart>[]): Promise<TaxRatePart[]> {
		this.assertStructure(taxRateId, parts ?? []);

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		const existing = await this.typeOrmTaxRatePartRepository.find({ where: { taxRateId } });

		await this.typeOrmTaxRatePartRepository.manager.transaction(async (manager) => {
			if (existing.length) {
				await manager.softDelete(
					TaxRatePart,
					existing.map((part) => part.id)
				);
			}

			for (const part of parts ?? []) {
				await manager.insert(TaxRatePart, {
					...part,
					taxRateId,
					organizationId,
					tenantId
				} as DeepPartial<TaxRatePart>);
			}
		});

		return await this.listForRate(taxRateId);
	}

	/**
	 * Creates one part of a rate.
	 *
	 * @param entity The part to create.
	 * @returns The persisted part.
	 * @throws BadRequestException when the part is not a usable element of a breakdown.
	 * @throws NotFoundException when the rate does not exist in the caller's tenant.
	 */
	public async create(entity: TaxWriteInput<TaxRatePart>): Promise<TaxRatePart> {
		const taxRateId = entity.taxRateId;
		if (!taxRateId) {
			throw new BadRequestException('A part belongs to a rate, and none was given.');
		}

		this.assertStructure(taxRateId, [entity]);
		await this.assertSequenceIsFree(taxRateId, entity.sequence ?? 1);

		return await super.create({ ...entity, taxRateId } as DeepPartial<TaxRatePart>);
	}

	/**
	 * Amends one part.
	 *
	 * @param id The part to amend.
	 * @param entity The members to change.
	 * @returns The updated part.
	 * @throws NotFoundException when the part does not exist in the caller's tenant.
	 * @throws BadRequestException when a changed member is not usable.
	 */
	public async update(id: ID, entity: TaxWriteInput<TaxRatePart>): Promise<TaxRatePart> {
		const part = await this.findOneByIdString(id);
		if (!part) {
			throw new NotFoundException(`The tax rate part ${id} was not found.`);
		}

		this.assertStructure(part.taxRateId, [{ ...part, ...entity } as TaxWriteInput<TaxRatePart>]);

		if (entity.sequence !== undefined && entity.sequence !== part.sequence) {
			await this.assertSequenceIsFree(part.taxRateId, entity.sequence);
		}

		await super.update(id, entity as DeepPartial<TaxRatePart>);

		return await this.findOneByIdString(id);
	}

	/**
	 * Removes one part of a rate.
	 *
	 * The row is soft-deleted: a tax line written under the breakdown this part belonged to names it, and
	 * the breakdown of a placed document has to stay explainable.
	 *
	 * @param criteria The part to remove, by id or by conditions.
	 * @returns The delete result, so the route keeps the platform's response shape.
	 */
	public async delete(criteria: string | FindOptionsWhere<TaxRatePart>): Promise<DeleteResult> {
		await super.softDelete(criteria);

		return { affected: 1, raw: [] } as DeleteResult;
	}

	/*
	|--------------------------------------------------------------------------
	| Validation
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param taxRateId The rate the list belongs to, used in the messages.
	 * @param parts The ordered list being written.
	 * @throws BadRequestException when any element is unusable, or when the list does not describe a
	 * breakdown that adds up.
	 */
	private assertStructure(taxRateId: ID, parts: TaxWriteInput<TaxRatePart>[]): void {
		const sequences = new Set<number>();

		for (const part of parts) {
			const sequence = part.sequence ?? 1;
			if (!Number.isInteger(sequence) || sequence < 1) {
				throw new BadRequestException('A part is applied at a whole position, counted from one.');
			}
			if (sequences.has(sequence)) {
				throw new BadRequestException(
					`Two parts of the rate ${taxRateId} declare the position ${sequence}, so the order they are applied in is not defined.`
				);
			}
			sequences.add(sequence);

			if (compareDecimalStrings(part.factorPercent ?? 0, 0) === 0) {
				throw new BadRequestException(
					'A part carries a share of the rate, and its share may not be zero; a part that carries nothing is not a part.'
				);
			}
			if (compareDecimalStrings(part.baseFactor ?? 1, 0) <= 0) {
				throw new BadRequestException('A part is computed on a positive share of the value, never on nothing.');
			}
			this.assertFixedMembers(part);
		}

		this.assertSharesAddUp(parts);
	}

	/**
	 * @param part One part being written.
	 * @throws BadRequestException when the part states a fixed amount it cannot state, or states one it
	 * should not.
	 */
	private assertFixedMembers(part: TaxWriteInput<TaxRatePart>): void {
		if (part.amountType === TaxAmountType.FIXED) {
			if (part.fixedAmount === undefined || part.fixedAmount === null) {
				throw new BadRequestException('A fixed part states the amount it contributes per unit of the quantity.');
			}
			if (!part.fixedCurrency) {
				throw new BadRequestException('A fixed part states the currency of its amount; an amount without one is not an amount.');
			}

			return;
		}

		if (part.fixedAmount !== undefined && part.fixedAmount !== null) {
			throw new BadRequestException(
				'A part that is a share of the rate may not also state a fixed amount; declare it as a fixed part instead.'
			);
		}
	}

	/**
	 * @param parts The ordered list being written.
	 * @throws BadRequestException when the positive shares of the `TAX` parts do not sum to nothing or to
	 * the whole, or the negative shares do not sum to nothing or to the whole of a negative side. A part
	 * that produces no amount declares a base and is not counted.
	 */
	private assertSharesAddUp(parts: TaxWriteInput<TaxRatePart>[]): void {
		const producing = parts.filter((part) => (part.partType ?? TaxPartType.TAX) === TaxPartType.TAX);
		const positive = producing
			.filter((part) => compareDecimalStrings(part.factorPercent ?? 0, 0) > 0)
			.map((part) => part.factorPercent ?? 0);
		const negative = producing
			.filter((part) => compareDecimalStrings(part.factorPercent ?? 0, 0) < 0)
			.map((part) => part.factorPercent ?? 0);

		this.assertShareSums(positive, '100', 'the positive shares of the parts sum to neither nothing nor the whole.');
		this.assertShareSums(negative, '-100', 'the negative shares of the parts sum to neither nothing nor the whole.');
	}

	/**
	 * @param shares The shares of one side.
	 * @param whole The value the shares have to add up to, when they add up to anything.
	 * @param message The refusal to report.
	 * @throws BadRequestException when the shares add up to something other than nothing or the whole.
	 */
	private assertShareSums(shares: Array<number | string>, whole: string, message: string): void {
		if (!shares.length) {
			return;
		}

		const total = shares.reduce<string>((sum, share) => addDecimalStrings(sum, share), '0');

		if (compareDecimalStrings(total, 0) !== 0 && compareDecimalStrings(total, whole) !== 0) {
			throw new BadRequestException(
				`The shares a tax is made of have to add up: ${message} They sum to ${total}.`
			);
		}
	}

	/**
	 * @param taxRateId The rate a part is being written to.
	 * @param sequence The position the part declares.
	 * @throws BadRequestException when the rate already carries a part at that position.
	 */
	private async assertSequenceIsFree(taxRateId: ID, sequence: number): Promise<void> {
		const existing = await this.typeOrmTaxRatePartRepository.findOne({ where: { taxRateId, sequence } });
		if (existing) {
			throw new BadRequestException(`The rate ${taxRateId} already carries a part at position ${sequence}.`);
		}
	}
}
