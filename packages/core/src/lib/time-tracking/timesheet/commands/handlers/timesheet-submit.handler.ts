import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotAcceptableException, NotFoundException } from '@nestjs/common';
import { In, Not, IsNull } from 'typeorm';
import { ID, ITimesheet } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { EmailService } from './../../../../email-send/email.service';
import { TimesheetSubmitCommand } from '../timesheet-submit.command';
import { TimeSheetService } from '../../timesheet.service';

@CommandHandler(TimesheetSubmitCommand)
export class TimesheetSubmitHandler implements ICommandHandler<TimesheetSubmitCommand> {
	constructor(readonly _timeSheetService: TimeSheetService, readonly _emailService: EmailService) {}

	/**
	 * Marks one timesheet as submitted, only while it is still not submitted.
	 *
	 * @returns `true` when this call made the timesheet submitted, `false` when another submit got there first.
	 */
	private async claim(id: ID, organizationId: ID, submittedAt: Date): Promise<boolean> {
		try {
			const result = await this._timeSheetService.update(
				{ id, organizationId, submittedAt: IsNull() },
				{ submittedAt }
			);
			// One `UPDATE ... WHERE submittedAt IS NULL` statement: the database lets a single caller change the
			// row, and `affected` says whether that caller was this one (both ORMs report it).
			return ((result as { affected?: number } | undefined)?.affected ?? 0) > 0;
		} catch (error) {
			// `update` by criteria throws when no row matches any more: another submit won the race
			if (error instanceof NotFoundException) {
				return false;
			}
			throw error;
		}
	}

	/**
	 * Submits multiple timesheets by updating their status and sending notifications.
	 *
	 * @param {TimesheetSubmitCommand} command - The command containing timesheet IDs and submission status.
	 * @returns {Promise<ITimesheet[]>} - A promise resolving to the submitted timesheets.
	 *
	 * @throws {NotAcceptableException} - If no timesheet IDs are provided.
	 *
	 * @description
	 * This method updates the submission status of multiple timesheets. If the status is 'submit',
	 * it marks them as submitted by setting `submittedAt` to the current date. It then retrieves
	 * the updated timesheets and sends email notifications to employees.
	 */
	public async execute(command: TimesheetSubmitCommand): Promise<ITimesheet[]> {
		const { input } = command;
		let { ids, status, organizationId } = input;

		// Validate input
		if (isEmpty(ids)) {
			throw new NotAcceptableException('You cannot submit a timesheet without providing IDs');
		}

		// Normalize `ids` to always be an array
		ids = Array.isArray(ids) ? ids : [ids];

		const isSubmit = status === 'submit';

		// Timesheets that are already submitted keep their original `submittedAt` and are not announced again:
		// a repeated submit (double click, retried request, a bulk submit that overlaps) used to move the
		// submission time forward and email the employee once more for every call.
		const newlySubmittedIds = new Set<ID>();
		// The first claim that failed for another reason than a lost race, reported once the rest is announced
		let claimFailure: unknown;

		if (isSubmit) {
			const pending = await this._timeSheetService.find({
				where: { id: In(ids), organizationId, submittedAt: IsNull() }
			});

			// Each timesheet is claimed on its own, guarded by `submittedAt IS NULL` in the statement itself.
			// When two submits overlap, both may have read the timesheet as pending, but only one write can
			// still match: the loser neither moves the timestamp nor emails, and is not reported as an error.
			// Every claim is awaited, so one that fails does not hide the ones that committed: those are no
			// longer pending, so a retry would never announce them.
			const submittedAt = new Date();
			const outcomes = await Promise.allSettled(
				pending.map(({ id }) => this.claim(id, organizationId, submittedAt))
			);
			outcomes.forEach((outcome, index) => {
				if (outcome.status === 'fulfilled') {
					if (outcome.value) {
						newlySubmittedIds.add(pending[index].id);
					}
				} else if (claimFailure === undefined) {
					claimFailure = outcome.reason;
				}
			});

			// Nothing this call submitted is left to announce: the failure is the whole answer
			if (claimFailure !== undefined && newlySubmittedIds.size === 0) {
				throw claimFailure;
			}
		} else {
			await this._timeSheetService.update({ id: In(ids), organizationId }, { submittedAt: null });
		}

		// Fetch updated timesheets with employee and user details
		const timesheets = await this._timeSheetService.find({
			relations: { employee: { user: true } },
			where: {
				id: In(ids),
				organizationId,
				submittedAt: Not(IsNull())
			},
			select: {
				employee: {
					id: true,
					organizationId: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						email: true
					}
				}
			}
		});

		// Send email notifications
		if (isSubmit) {
			timesheets.forEach((timesheet: ITimesheet) => {
				// Only the timesheets this call submitted are announced
				if (!newlySubmittedIds.has(timesheet.id)) {
					return;
				}
				// Retrieve employee and user details
				const employee = timesheet.employee;
				// Send email notification to employee
				if (employee?.user?.email) {
					this._emailService.timesheetSubmit(employee.user.email, timesheet);
				}
			});
		}

		// The timesheets this call did submit are announced; the claim that failed is still reported, and a retry
		// submits it (the others are no longer pending, so they are neither stamped nor emailed again)
		if (claimFailure !== undefined) {
			throw claimFailure;
		}

		return timesheets;
	}
}
