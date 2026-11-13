import { EstimateStatusTypesEnum, IInvoice, IInvoiceUpdateInput } from '@gauzy/contracts';
import { Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { EstimateEmail, Invoice } from '../../../../core/entities/internal';
import { EstimateAnsweredEvent } from '../../../../invoice/estimate-answer/estimate-answered.event';
import { TypeOrmInvoiceRepository } from '../../../../invoice/repository/type-orm-invoice.repository';
import { PublicInvoiceUpdateCommand } from '../public-invoice-update.command';
import { PublicInvoiceService } from './../../public-invoice.service';

/** A client's answer the team hears of: an acceptance or a decline, and whether it made the estimate an invoice. */
interface IAnswerGiven {
	isAccepted: boolean;
	isConverted: boolean;
}

/**
 * What a client's update from the estimate email answers, or null when it is no answer the team hears of. ACCEPTED is
 * an acceptance, and so is DRAFT with `isEstimate: false`, which the public page sends where the organization converts
 * accepted estimates (the estimate becomes a draft invoice). REJECTED is a decline.
 */
function answerGivenBy(entity: IInvoiceUpdateInput): IAnswerGiven | null {
	const status = entity?.status;
	const isConverted = entity?.isEstimate === false;
	const acceptsByConverting = isConverted && status === EstimateStatusTypesEnum.DRAFT;
	if (status === EstimateStatusTypesEnum.ACCEPTED || acceptsByConverting) {
		return { isAccepted: true, isConverted };
	}
	if (status === EstimateStatusTypesEnum.REJECTED) {
		return { isAccepted: false, isConverted };
	}
	return null;
}

/** An estimate as it was before the client's answer. */
type IEstimateBefore = Pick<IInvoice, 'id' | 'status' | 'isEstimate' | 'tenantId'>;

/** How many rows the update changed, when the database driver reports it. */
function changedRowsOf(result: IInvoice | UpdateResult): number | undefined {
	const affected = (result as UpdateResult)?.affected;
	return typeof affected === 'number' ? affected : undefined;
}

@CommandHandler(PublicInvoiceUpdateCommand)
export class PublicInvoiceUpdateHandler implements ICommandHandler<PublicInvoiceUpdateCommand> {
	private readonly logger = new Logger(PublicInvoiceUpdateHandler.name);

	constructor(
		private readonly publicInvoiceService: PublicInvoiceService,
		@InjectRepository(Invoice)
		private readonly typeOrmInvoiceRepository: TypeOrmInvoiceRepository,
		@InjectRepository(EstimateEmail)
		private readonly typeOrmEstimateEmailRepository: Repository<EstimateEmail>,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Saves the client's answer (`PublicInvoiceService.updateInvoice`, which checks the link and writes only an answer
	 * that changes the estimate), then, when this answer changed it to accepted or declined, or turned it into a draft
	 * invoice where the organization converts accepted estimates, tells the team (`EstimateAnsweredEvent`). The same
	 * answer given twice, even at the same moment, is told once, and a refused answer not at all.
	 */
	public async execute(command: PublicInvoiceUpdateCommand): Promise<IInvoice | UpdateResult> {
		const { params, entity } = command;
		const before = await this.estimateBefore(params.id);
		const result = await this.publicInvoiceService.updateInvoice(params, entity);
		await this.publishAnswer(params, entity, before, changedRowsOf(result));
		return result;
	}

	/** The estimate before the answer (whether it is one, its tenant), or null when it cannot be read. */
	private async estimateBefore(id: IInvoice['id']): Promise<IEstimateBefore | null> {
		try {
			return await this.typeOrmInvoiceRepository.findOne({
				where: { id },
				select: { id: true, status: true, isEstimate: true, tenantId: true }
			});
		} catch {
			return null;
		}
	}

	/**
	 * Publishes the answer when it changed an estimate to accepted or declined, or converted it: the update changed a
	 * row. Where the database does not report that count, what was read before the update decides: the status, or, for
	 * a conversion, that the document was still an estimate. Never fails the saved answer.
	 */
	private async publishAnswer(
		params: IInvoice,
		entity: IInvoiceUpdateInput,
		before: IEstimateBefore | null,
		changedRows: number | undefined
	) {
		const given = answerGivenBy(entity);
		const wasChanged = given?.isConverted || before?.status !== entity?.status;
		const hasChanged = changedRows === undefined ? wasChanged : changedRows > 0;
		const isNewAnswer = Boolean(before?.isEstimate) && hasChanged;
		if (!given || !isNewAnswer) {
			return;
		}
		const answeredFrom = await this.answeringAddressOf(params, before);
		try {
			this.eventBus.publish(
				new EstimateAnsweredEvent({
					invoiceId: before.id,
					tenantId: before.tenantId,
					isAccepted: given.isAccepted,
					isConverted: given.isConverted,
					answeredFrom
				})
			);
		} catch (error) {
			this.logger.warn(
				`The answer to estimate ${before.id} was saved, but the team could not be told: ${error?.message}`
			);
		}
	}

	/**
	 * The address the estimate link was sent to, which answered: the update found this token's live estimate email.
	 * Null when it cannot be read, and the answer is told without it: a second answer, which changes nothing, would not
	 * tell it any more.
	 */
	private async answeringAddressOf(params: IInvoice, before: IEstimateBefore): Promise<string | null> {
		try {
			const estimateEmail = await this.typeOrmEstimateEmailRepository.findOne({
				where: { token: params.token, tenantId: before.tenantId },
				select: { id: true, email: true }
			});
			return estimateEmail?.email ?? null;
		} catch (error) {
			this.logger.warn(`The address that answered estimate ${before.id} could not be read: ${error?.message}`);
			return null;
		}
	}
}
