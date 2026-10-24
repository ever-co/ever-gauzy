import { ConflictException, NotFoundException } from '@nestjs/common';
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import {
	ApprovalPolicyTypesStringEnum,
	ID,
	StatusTypesEnum,
	StatusTypesMapRequestApprovalEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { isWithinOrganizationBoundary } from '../../../core/crud/organization-boundary';
import { RequestApprovalStatusCommand } from '../request-approval.status.command';
import { RequestApproval } from '../../request-approval.entity';
import {
	IRequestApprovalAnswerTransaction,
	IRequestApprovalLinkedDocument,
	IRequestApprovalSettlement,
	RequestApprovalLinkedDocumentKind,
	RequestApprovalService
} from '../../request-approval.service';
import { RequestApprovalVerdict } from '../../request-approval-decision';
import { assertMayDecideLinkedDocument } from '../../linked-document-decision.gate';

/**
 * Answers a request approval: `PUT /request-approval/approval/:id`, `PUT /request-approval/refuse/:id`, and the
 * GraphQL `approveRequestApproval` / `refuseRequestApproval` that dispatch the same command.
 *
 * The routes are open to `REQUEST_APPROVAL_EDIT`, which every employee holds, so the handler decides who may
 * answer: a designated approver of the request (their own employee slot, or an approver team they belong to) or a
 * tenant administrator; `min_count` decides when approvers' approvals approve the request; a decided request is a
 * conflict except to an administrator deciding it the other way (see `request-approval-decision.ts`).
 *
 * When the answer decides the request, the time-off request or equipment sharing it is about moves with it — and
 * only for a caller who could move that document through its own approve/refuse route, because this command is a
 * second door onto the same state change.
 *
 * The whole answer is one transaction (see {@link RequestApprovalService.answer}): the request is read again under a
 * row lock, the decision is made on what the lock found, and the slots, the request's status and the document are
 * written in the same commit. Two approvers answering at the same time answer one after the other, so the document
 * ends up with the request's own decision, and a refusal (403, 404, or the document's 409) leaves the request, its
 * slots and the document exactly as they were.
 */
@CommandHandler(RequestApprovalStatusCommand)
export class RequestApprovalStatusHandler implements ICommandHandler<RequestApprovalStatusCommand> {
	constructor(private readonly requestApprovalService: RequestApprovalService) {}

	public async execute(command?: RequestApprovalStatusCommand): Promise<RequestApproval> {
		const { requestApprovalId, status } = command;

		return await this.requestApprovalService.answer(
			requestApprovalId,
			status as RequestApprovalVerdict,
			(settlement) => this.settleLinkedDocument(settlement)
		);
	}

	/**
	 * Moves the document a settling decision is about, on the answer's transaction.
	 *
	 * The caller must pass the document's own approve/refuse gate. The document is then read on the transaction, in the
	 * scope its own service reads it in — the caller's tenant, withdrawn rows left out, and the caller's organization
	 * unless they are a tenant administrator — and is not found otherwise.
	 *
	 * @param settlement The request as the locked read found it, what the answer did, and the transaction.
	 * @throws ForbiddenException when the caller does not pass the document's gate.
	 * @throws NotFoundException when the document is not in the caller's scope.
	 * @throws ConflictException when a time-off request was decided otherwise.
	 */
	private async settleLinkedDocument({
		requestApproval,
		outcome,
		transaction
	}: IRequestApprovalSettlement): Promise<void> {
		assertMayDecideLinkedDocument(requestApproval.requestType);

		const tenantId = RequestContext.currentTenantId() ?? requestApproval.tenantId;

		if (requestApproval.requestType === ApprovalPolicyTypesStringEnum.TIME_OFF) {
			const timeOffStatus = StatusTypesMapRequestApprovalEnum[outcome.status] as StatusTypesEnum;
			const timeOff = await this.readLinkedDocument(transaction, 'time-off', requestApproval.requestId, tenantId);
			await this.moveTimeOff(transaction, timeOff.id, tenantId, timeOffStatus);
		} else if (requestApproval.requestType === ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING) {
			const sharing = await this.readLinkedDocument(
				transaction,
				'equipment-sharing',
				requestApproval.requestId,
				tenantId
			);
			await transaction.moveEquipmentSharing(sharing.id, tenantId, outcome.status);
		}
	}

	/**
	 * Reads the document a request is about, in the scope its own service reads it in.
	 *
	 * @throws NotFoundException when it is not there, or outside the caller's organization boundary.
	 */
	private async readLinkedDocument(
		transaction: IRequestApprovalAnswerTransaction,
		kind: RequestApprovalLinkedDocumentKind,
		id: ID,
		tenantId: ID
	): Promise<IRequestApprovalLinkedDocument> {
		const document = id && tenantId ? await transaction.readLinkedDocument(kind, id, tenantId) : null;

		if (!document || !isWithinOrganizationBoundary(document.organizationId)) {
			throw new NotFoundException(`The ${kind} this request approval is about was not found.`);
		}

		return document;
	}

	/**
	 * Moves the time-off request a decision is about.
	 *
	 * The leave moves only while it is `REQUESTED` (a compare-and-set, as the time-off route's own 409 states). A
	 * leave can already carry the status this decision gives it — it was decided through its own route — and the
	 * answer is written then, instead of being refused. Any other status stands, such as an administrator deciding an
	 * approved leave the other way.
	 *
	 * @param transaction The answer's transaction.
	 * @param id The time-off request.
	 * @param tenantId The caller's tenant.
	 * @param status The status the decision gives it.
	 * @throws ConflictException when the leave was decided otherwise.
	 */
	private async moveTimeOff(
		transaction: IRequestApprovalAnswerTransaction,
		id: ID,
		tenantId: ID,
		status: StatusTypesEnum
	): Promise<void> {
		if ((await transaction.moveTimeOff(id, tenantId, status)) > 0) {
			return;
		}
		if ((await transaction.readLinkedDocument('time-off', id, tenantId))?.status === status) {
			return;
		}
		throw new ConflictException('Request time off is Conflict');
	}
}
