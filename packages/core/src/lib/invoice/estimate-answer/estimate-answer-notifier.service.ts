import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployee,
	IInvoice,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { Employee } from '../../core/entities/internal';
import { EmailService } from '../../email-send/email.service';
import { EmployeeCreateNotificationEvent } from '../../employee-notification/events/employee-notification.event';
import { inboxEmailsNotifications } from '../../employee-notification/inbox-notification-emails';
import { TypeOrmInvoiceRepository } from '../repository/type-orm-invoice.repository';
import { runInEstimateAnswerContext } from './estimate-answer-context';
import { IEstimateAnswer } from './estimate-answered.event';
import { clientNameOf, emailsCreator, estimateAnswerNotice, formattedAmountOf } from './estimate-answer.notice';

/** Who hears of a client's answer in-app: whoever may edit the organization's invoices and estimates. */
const INVOICE_HANDLING_PERMISSION = PermissionsEnum.INVOICES_EDIT;

/**
 * Tells the team that a client accepted or declined an estimate from the estimate email, which used to change its
 * status and tell nobody:
 * - every active employee of the organization whose role grants INVOICES_EDIT gets an `Invoice` notification about the
 *   estimate (in-app always; by email and push as their notification settings say, where the Inbox sends them);
 * - the team member who created the estimate gets the `estimate-answered` email, unless the Inbox already emails them
 *   that notification (`emailsCreator`).
 *
 * The answer comes on a public route, where nobody is signed in: the team is told inside a request context of the
 * estimate's tenant and organization (`runInEstimateAnswerContext`), which the notifications are filed in.
 */
@Injectable()
export class EstimateAnswerNotifier {
	private readonly logger = new Logger(EstimateAnswerNotifier.name);

	constructor(
		private readonly typeOrmInvoiceRepository: TypeOrmInvoiceRepository,
		private readonly emailService: EmailService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Notifies the team of a client's answer.
	 *
	 * @param answer - The answer, as the estimate's public link took it.
	 */
	async notify(answer: IEstimateAnswer): Promise<void> {
		const estimate = await this.findEstimate(answer);
		if (!estimate) {
			this.logger.warn(`Estimate ${answer.invoiceId} was answered but could not be read: nobody is told.`);
			return;
		}
		const scope = { tenantId: estimate.tenantId, organizationId: estimate.organizationId };
		await runInEstimateAnswerContext(scope, () => this.tellTeam(estimate, answer));
	}

	/** Notifies the invoice handlers in-app, and emails the estimate's creator unless the Inbox emails them already. */
	private async tellTeam(estimate: IInvoice, answer: IEstimateAnswer): Promise<void> {
		const notified = await this.findInvoiceHandlers(estimate.organizationId, estimate.tenantId);
		const notice = estimateAnswerNotice(estimate, answer);
		for (const { id: receiverEmployeeId } of notified) {
			this.eventBus.publish(
				new EmployeeCreateNotificationEvent({
					...notice,
					type: EmployeeNotificationTypeEnum.INVOICE,
					entity: BaseEntityEnum.Invoice,
					entityId: estimate.id,
					receiverEmployeeId,
					organizationId: estimate.organizationId,
					tenantId: estimate.tenantId
				})
			);
		}

		const notifiedUserIds = notified.map((employee) => employee.userId);
		if (emailsCreator(estimate.createdByUser, notifiedUserIds, inboxEmailsNotifications())) {
			await this.emailCreator(estimate, answer);
		}
	}

	/** The estimate in its tenant, with the parts the notice and the email read, and nothing of its creator but these. */
	private async findEstimate({ invoiceId, tenantId }: IEstimateAnswer): Promise<IInvoice | null> {
		return await this.typeOrmInvoiceRepository.findOne({
			where: { id: invoiceId, tenantId, isEstimate: true },
			relations: { toContact: true, organization: true, createdByUser: true },
			select: {
				id: true,
				invoiceNumber: true,
				totalValue: true,
				currency: true,
				isEstimate: true,
				organizationId: true,
				tenantId: true,
				toContact: { id: true, name: true },
				organization: { id: true, name: true },
				createdByUser: { id: true, email: true, isActive: true, preferredLanguage: true }
			}
		});
	}

	/** The organization's active employees whose role grants the permission that handles invoices. */
	private async findInvoiceHandlers(organizationId: ID, tenantId: ID): Promise<Pick<IEmployee, 'id' | 'userId'>[]> {
		return await this.typeOrmInvoiceRepository.manager.find(Employee, {
			where: {
				organizationId,
				tenantId,
				isActive: true,
				isArchived: false,
				user: {
					isActive: true,
					role: { rolePermissions: { permission: INVOICE_HANDLING_PERMISSION, enabled: true } }
				}
			},
			select: { id: true, userId: true }
		});
	}

	/** The `estimate-answered` email to the estimate's creator, in their language. */
	private async emailCreator(estimate: IInvoice, answer: IEstimateAnswer): Promise<void> {
		const creator = estimate.createdByUser;
		const languageCode = (creator.preferredLanguage as LanguagesEnum) || LanguagesEnum.ENGLISH;
		await this.emailService.sendEstimateAnswered({
			languageCode,
			email: creator.email,
			user: creator,
			organization: { ...estimate.organization, tenantId: estimate.tenantId },
			invoiceId: estimate.id,
			invoiceNumber: estimate.invoiceNumber,
			isAccepted: answer.isAccepted,
			contactName: clientNameOf(estimate),
			contactEmail: answer.answeredFrom,
			amount: formattedAmountOf(estimate.totalValue, languageCode),
			currency: estimate.currency
		});
	}
}
