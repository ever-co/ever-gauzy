import { Injectable } from '@nestjs/common';
import { ID, JsonData } from '@gauzy/contracts';
import { EntityManager } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { PaymentTermLine } from './payment-term-line.entity';
import { PaymentDueBasis, PaymentTermLineType } from './payment-term.enums';
import { TypeOrmPaymentTermLineRepository } from './repository/type-orm-payment-term-line.repository';
import { MikroOrmPaymentTermLineRepository } from './repository/mikro-orm-payment-term-line.repository';

/**
 * One instalment as it is written.
 *
 * The shape is declared here rather than imported from `PaymentTermService` so that the two services
 * do not import each other: the header service composes this one, and the dependency runs one way.
 */
export interface IPaymentTermLineWrite {
	sequence?: number;
	valueType?: PaymentTermLineType;
	valueAmount: string;
	currency?: string;
	dueBasis?: PaymentDueBasis;
	days?: number;
	dayOfMonth?: number;
	metadata?: JsonData;
}

/**
 * Writes and reads the instalments of a settlement term.
 *
 * Instalments are **not** a resource of their own: an instalment is addressed by its position inside
 * the term that owns it, and a term is the thing a document names. That is why this service has no
 * controller and no route — the term's own endpoints carry its lines, and `PUT
 * /api/payment-terms/:id/lines` is the whole write surface an instalment has.
 *
 * Replacing a term's instalments is one transaction: the lines are removed and re-written together,
 * because a schedule read halfway through a rewrite is a schedule that reconciles against nothing.
 */
@Injectable()
export class PaymentTermLineService extends TenantAwareCrudService<PaymentTermLine> {
	constructor(
		readonly typeOrmPaymentTermLineRepository: TypeOrmPaymentTermLineRepository,
		readonly mikroOrmPaymentTermLineRepository: MikroOrmPaymentTermLineRepository
	) {
		super(typeOrmPaymentTermLineRepository, mikroOrmPaymentTermLineRepository);
	}

	/**
	 * The instalments of one term, in presentation order.
	 *
	 * @param paymentTermId The term id.
	 * @returns The instalments.
	 */
	async listByTerm(paymentTermId: ID): Promise<PaymentTermLine[]> {
		return this.find({
			where: {
				paymentTermId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { sequence: 'ASC' }
		} as any);
	}

	/**
	 * Replaces a term's instalments.
	 *
	 * @param paymentTermId The term id.
	 * @param lines The instalments the term is to carry.
	 * @param manager The transaction to write inside, when the caller has one. A header and its
	 * instalments are one decision, so the caller that creates both supplies its own manager.
	 * @returns The stored instalments.
	 */
	async replaceLines(
		paymentTermId: ID,
		lines: IPaymentTermLineWrite[],
		manager?: EntityManager
	): Promise<PaymentTermLine[]> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const write = async (entityManager: EntityManager): Promise<PaymentTermLine[]> => {
			await entityManager.delete(PaymentTermLine, { paymentTermId, tenantId } as any);

			const created = lines.map((line, index) =>
				entityManager.create(PaymentTermLine, {
					paymentTermId,
					sequence: line.sequence ?? index + 1,
					valueType: line.valueType ?? PaymentTermLineType.PERCENT,
					valueAmount: line.valueAmount,
					currency: line.currency,
					dueBasis: line.dueBasis ?? PaymentDueBasis.INVOICE_DATE,
					days: line.days ?? 0,
					dayOfMonth: line.dayOfMonth,
					metadata: line.metadata,
					tenantId,
					organizationId
				} as Partial<PaymentTermLine>)
			);

			return entityManager.save(created);
		};

		if (manager) {
			return write(manager);
		}

		return this.typeOrmRepository.manager.transaction(write);
	}
}
