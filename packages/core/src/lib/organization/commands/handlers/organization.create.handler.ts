import { BadRequestException, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { faker } from '@faker-js/faker';
import {
	IAgentRestrictionLocation,
	ID,
	IOrganization,
	IOrganizationCreateInput,
	IScreenshotCaptureAcknowledgementRecord,
	IUser,
	newOrganizationAllowsScreenshotCapture,
	RolesEnum
} from '@gauzy/contracts';
import { UserService } from '../../../user/user.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { OrganizationService } from '../../organization.service';
import { ContactService } from '../../../contact/contact.service';
import { ActivityLogService } from '../../../activity-log/activity-log.service';
import { OrganizationCreateCommand } from '../organization.create.command';
import { OrganizationCommerceDefaultsCreateCommand } from '../organization-commerce-defaults.create.command';
import { assertNoAgentRestrictionOnCreate } from '../../../employee/agent-exit-logout-restriction';
import { ReportOrganizationCreateCommand } from './../../../reports/commands';
import { RequestContext } from '../../../core/context';
import { runOutsideOrganizationBoundary } from '../../../core/crud/organization-boundary';
import { Organization } from './../../../core/entities/internal';
import { ImportRecordUpdateOrCreateCommand } from './../../../export-import/import-record';
import { OrganizationStatusBulkCreateCommand } from './../../../tasks/statuses/commands';
import { OrganizationTaskSizeBulkCreateCommand } from './../../../tasks/sizes/commands';
import { OrganizationTaskPriorityBulkCreateCommand } from './../../../tasks/priorities/commands';
import { OrganizationIssueTypeBulkCreateCommand } from './../../../tasks/issue-type/commands';
import { OrganizationTaskSettingCreateCommand } from '../../../organization-task-setting/commands';
import {
	currentContactId,
	linkedContactCountry,
	logScreenshotCaptureAcknowledgement,
	omitScreenshotCaptureAcknowledgementFields,
	resolveScreenshotCaptureAcknowledgement
} from '../../screenshot-capture-acknowledgement';

@CommandHandler(OrganizationCreateCommand)
export class OrganizationCreateHandler implements ICommandHandler<OrganizationCreateCommand> {
	private readonly logger = new Logger(OrganizationCreateHandler.name);

	constructor(
		private readonly commandBus: CommandBus,
		private readonly organizationService: OrganizationService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly userService: UserService,
		private readonly contactService: ContactService,
		private readonly activityLogService: ActivityLogService
	) {}

	/**
	 * Asynchronously executes the process of creating a new organization, along with associated tasks such as
	 * adding users to the organization, creating contact details, executing various update tasks, and handling import records.
	 * This function encapsulates several steps, each responsible for a part of the organization creation process.
	 *
	 * @param command An instance of OrganizationCreateCommand, containing the input data and settings required to create the organization.
	 * @returns A promise that resolves to an instance of IOrganization, representing the newly created organization.
	 */
	public async execute(command: OrganizationCreateCommand): Promise<IOrganization> {
		// Issue #9873: exit/logout can only be restricted on an existing organization, with an acknowledgement.
		// Checked before the `try` below, which turns every error into a generic one.
		assertNoAgentRestrictionOnCreate(command.input);
		// Issue #9872: a new organization starts with screen capture off. Turning it on here, for an EEA/UK
		// organization, takes the admin's acknowledgement, which is recorded on the row. Also checked before
		// the `try`, so the refusal keeps its code.
		const { allowScreenshotCapture, screenshotCaptureAcknowledgement } = await this.resolveScreenshotCapture(
			command.input
		);
		try {
			const input = omitScreenshotCaptureAcknowledgementFields(command.input);
			const { isImporting = false, sourceId = null, userOrganizationSourceId = null } = input;
			const tenantId = RequestContext.currentTenantId();

			const admins: IUser[] = [];

			// 1. Get all Super Admin Users of the Tenant
			const superAdminUsers = await this.userService.find({
				where: {
					tenantId,
					role: {
						name: RolesEnum.SUPER_ADMIN,
						tenantId
					}
				}
			});
			admins.push(...superAdminUsers);

			// 2. Organization will add to all SUPER_ADMIN/ADMIN users, if ADMIN create organization.
			if (RequestContext.hasRole(RolesEnum.ADMIN)) {
				const adminUsers = await this.userService.find({
					where: {
						tenantId,
						role: {
							name: RolesEnum.ADMIN,
							tenantId
						}
					}
				});
				admins.push(...adminUsers);
			}

			let { contact = {} } = input;
			delete input['contact'];
			// Issue #9872: the flag written is the resolved one, and only when there is one. For a create that names a
			// stored organization, an absent or unchanged flag leaves the key out, so neither ORM touches the column.
			delete input.allowScreenshotCapture;

			// 3. Create organization
			const organization: IOrganization = await this.organizationService.create({
				...input,
				upworkOrganizationId: input.upworkOrganizationId || null,
				upworkOrganizationName: input.upworkOrganizationName || null,
				// Simplify boolean assignments
				futureDateAllowed: input.futureDateAllowed !== false,
				show_profits: input.show_profits === true,
				show_bonuses_paid: input.show_bonuses_paid === true,
				show_income: input.show_income === true,
				show_total_hours: input.show_total_hours === true,
				show_projects_count: input.show_projects_count !== false,
				show_minimum_project_size: input.show_minimum_project_size !== false,
				show_clients_count: input.show_clients_count !== false,
				show_clients: input.show_clients !== false,
				show_employees_count: input.show_employees_count !== false,
				brandColor: faker.color.rgb(),
				...(input.standardWorkHoursPerDay && {
					standardWorkHoursPerDay: input.standardWorkHoursPerDay
				}),
				...(allowScreenshotCapture !== undefined && { allowScreenshotCapture }),
				...screenshotCaptureAcknowledgement
			});
			const { id: organizationId } = organization;

			if (screenshotCaptureAcknowledgement) {
				// The new organization is not the one of the caller's token, so its log entry is written outside the
				// organization boundary, as the provisioning steps below are (the create itself is authorized).
				await runOutsideOrganizationBoundary(() =>
					logScreenshotCaptureAcknowledgement(
						this.activityLogService,
						organization,
						screenshotCaptureAcknowledgement
					)
				);
			}

			// 4. Take each super admin user and add him/her to created organization
			try {
				const userOrganizations = admins.map(async (user: IUser) => {
					// The new organization is not the one of the caller's token: adding its admins to it is a crossing
					// by design, which the membership service otherwise refuses a caller confined to their organization.
					const userOrganization = await runOutsideOrganizationBoundary(() =>
						this.userOrganizationService.create({
							organization: {
								id: organizationId
							},
							user
						})
					);
					if (isImporting && userOrganizationSourceId) {
						await this.commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: this.userOrganizationService.tableName,
								sourceId: userOrganizationSourceId,
								destinationId: userOrganization.id,
								tenantId
							})
						);
					}
				});
				await Promise.all(userOrganizations);
			} catch (e) {
				console.log('An error occurred while processing user organizations. Details:', e);
			}

			// Steps 5 to 7 seed the organization this request has just created, which is not the organization of the
			// caller's token: they run outside the organization boundary, as creating the organization was the check.
			// 5. Create contact details of created organization
			try {
				contact = await runOutsideOrganizationBoundary(() =>
					this.contactService.create({
						...contact,
						organization: { id: organizationId }
					})
				);
				await this.organizationService.update(organizationId, {
					contactId: contact.id
				});
			} catch (error) {
				console.log('Error occurred during creation of contact details or updating the organization:', error);
			}

			// 6. Seed the commerce defaults the organization needs before it can issue a document: its default
			// channel and region, the seven numbering series (ORDER, PO, …), the default tax category, the
			// currency price preference, the measurement families and the search definitions. Awaited, so the
			// organization the response returns can place its first order; a failure is logged and does not
			// undo the organization (the step is idempotent and can be re-run).
			await runOutsideOrganizationBoundary(() => this.createCommerceDefaults(organization));

			// 7. Execute organization update tasks in the background (fire-and-forget).
			runOutsideOrganizationBoundary(() => this.executeOrganizationUpdateTasks(organization)).catch((error) =>
				this.logger.error('Unhandled error in execute organization update tasks:', error?.message)
			);

			// 8. Create Import Records while migrating for relative organization.
			if (isImporting && sourceId) {
				const { sourceId } = input;
				await this.commandBus.execute(
					new ImportRecordUpdateOrCreateCommand({
						entityType: this.organizationService.tableName,
						sourceId,
						destinationId: organizationId,
						tenantId
					})
				);
			}
			return await this.organizationService.findOneByIdString(organizationId);
		} catch (error) {
			console.log('An error occurred during the organization creation process.', error);
			throw new BadRequestException(error, 'An error occurred during the organization creation process.');
		}
	}

	/**
	 * Seeds the per-organization commerce defaults (R5-05). Without them an organization created at runtime
	 * cannot number an order (404 "No numbering series is configured for ORDER") or a purchase order (409
	 * `PURCHASE_ORDER_SEQUENCE_MISSING`). See `createDefaultCommerceDefaults`.
	 *
	 * @param organization The organization just created.
	 */
	private async createCommerceDefaults(organization: IOrganization): Promise<void> {
		try {
			await this.commandBus.execute(new OrganizationCommerceDefaultsCreateCommand(organization));
		} catch (error) {
			this.logger.error(
				`Could not seed the commerce defaults of organization ${organization.id}: ${error?.message}`
			);
		}
	}

	/**
	 * Executes various organization update tasks concurrently. This function
	 * triggers several operations related to an organization, such as creating reports,
	 * task statuses, task sizes, task priorities, issue types, and task settings.
	 * These operations are executed in parallel. If any operation fails,
	 * the error is caught and logged.
	 *
	 * @param organization An instance of the Organization class, representing the organization for which the update tasks are to be executed.
	 * @param organizationId The unique identifier of the organization, used in some of the update tasks.
	 * @returns Promise<void> This function returns a promise that resolves to void.
	 */
	public async executeOrganizationUpdateTasks(organization: Organization): Promise<void> {
		try {
			await Promise.all([
				// 1. Create report for relative organization.
				this.commandBus.execute(new ReportOrganizationCreateCommand(organization)),
				// 2. Create task statuses for relative organization.
				this.commandBus.execute(new OrganizationStatusBulkCreateCommand(organization)),
				// 3. Create task sizes for relative organization.
				this.commandBus.execute(new OrganizationTaskSizeBulkCreateCommand(organization)),
				// 4. Create task priorities for relative organization.
				this.commandBus.execute(new OrganizationTaskPriorityBulkCreateCommand(organization)),
				// 5. Create issue types for relative organization.
				this.commandBus.execute(new OrganizationIssueTypeBulkCreateCommand(organization)),
				// 6. Create task setting for relative organization.
				this.commandBus.execute(new OrganizationTaskSettingCreateCommand({ organization }))
			]);
		} catch (error) {
			this.logger.error('Error occurred while executing organization update tasks:', error?.message);
		}
	}

	/**
	 * Issue #9872: the screen capture value to create the organization with, and the acknowledgement to record
	 * with it (see `resolveScreenshotCaptureAcknowledgement`).
	 *
	 * A new organization starts with capture off unless the request turns it on. A request whose `id` names an
	 * organization of this tenant makes the save update that organization, so it is judged as the update it is:
	 * the stored value stays unless the request sets one, turning it on is a change from the stored value, and
	 * the stored location counts as well as the requested one. As in the update handler, the flag is then written
	 * only when the request changes it, so a stale value is never written back. A contact the request names by id
	 * (which the create below files with the fields sent, keeping the others) counts with the country it has.
	 *
	 * @param input The create request.
	 * @returns the value to write (`undefined`: leave the stored one) and the acknowledgement record, if any
	 * @throws ApiException 400 `SCREENSHOT_CAPTURE_ACKNOWLEDGEMENT_REQUIRED` (see `resolveScreenshotCaptureAcknowledgement`)
	 */
	private async resolveScreenshotCapture(input: IOrganizationCreateInput): Promise<{
		allowScreenshotCapture: boolean | undefined;
		screenshotCaptureAcknowledgement: IScreenshotCaptureAcknowledgementRecord | null;
	}> {
		const stored = await this.findStoredOrganization(input.id);

		const effective =
			stored && typeof input.allowScreenshotCapture !== 'boolean'
				? stored.allowScreenshotCapture
				: newOrganizationAllowsScreenshotCapture(input);
		const linkedCountry = effective
			? await linkedContactCountry(this.contactService, input.contact?.id, currentContactId(stored))
			: undefined;
		const locations: IAgentRestrictionLocation[] = [
			{
				regionCode: input.regionCode,
				timeZone: input.timeZone,
				country: input.contact?.country || input.country
			},
			{ country: linkedCountry },
			...(stored
				? [{ regionCode: stored.regionCode, timeZone: stored.timeZone, country: stored.contact?.country }]
				: [])
		];

		const screenshotCaptureAcknowledgement = resolveScreenshotCaptureAcknowledgement(
			{ ...input, allowScreenshotCapture: effective },
			stored,
			locations
		);
		return {
			allowScreenshotCapture: stored && effective === stored.allowScreenshotCapture ? undefined : effective,
			screenshotCaptureAcknowledgement
		};
	}

	/** The organization of the current tenant a create request's `id` names, if any. */
	private async findStoredOrganization(id: ID | undefined): Promise<IOrganization | null> {
		if (!id) return null;
		const found = await this.organizationService.findOneOrFailByIdString(id, { relations: { contact: true } });
		return found.success ? found.record : null;
	}
}
