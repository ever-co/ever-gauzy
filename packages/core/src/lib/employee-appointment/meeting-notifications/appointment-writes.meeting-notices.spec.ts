// Must stay first: loads the entity graph before the handlers pull an entity.
import '../../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
	EmployeeAppointmentStatus,
	IEmployeeAppointmentCreateInput,
	IEmployeeAppointmentUpdateInput,
	LanguagesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { EmployeeAppointmentCreateCommand, EmployeeAppointmentUpdateCommand } from '../commands';
import { EmployeeAppointmentCreateHandler } from '../commands/handlers/employee-appointment.create.handler';
import { EmployeeAppointmentUpdateHandler } from '../commands/handlers/employee-appointment.update.handler';
import { EmployeeAppointmentController } from '../employee-appointment.controller';

/**
 * What the writes of an appointment tell its invitees (ever-co/ever-teams#5022): the create invites those it names,
 * an update invites the added, tells the removed they no longer are and the kept what changed, and a cancellation (by
 * status or by deletion) tells everyone invited. The meeting notification service is doubled: what is under test is
 * what each write asks it to do, and that a write naming no invitees behaves as before.
 */

const START = new Date('2030-11-12T13:00:00.000Z');
const END = new Date('2030-11-12T13:30:00.000Z');

function meetingNotificationsDouble(invited: string[] = []) {
	return {
		checkedInviteeIdsOf: jest.fn(async (ids: string[]) => ids),
		replaceInvitees: jest.fn(async (_meeting: unknown, ids: string[]) => ({
			added: ids.filter((id) => !invited.includes(id)),
			removed: invited.filter((id) => !ids.includes(id)),
			kept: invited.filter((id) => ids.includes(id))
		})),
		inviteeIdsOf: jest.fn(async () => invited),
		notify: jest.fn<Promise<number>, unknown[]>(async () => 1)
	};
}

describe('appointment writes and the meeting notices', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('host-1');
	});
	afterEach(() => jest.restoreAllMocks());

	describe('create', () => {
		const setup = (meetingNotifications = meetingNotificationsDouble()) => {
			const employeeAppointmentService = {
				create: jest.fn(async (appointment) => ({ ...appointment, id: 'appointment-1', organizationId: 'org-1' }))
			};
			const handler = new EmployeeAppointmentCreateHandler(
				employeeAppointmentService as never,
				{ sendAppointmentMail: jest.fn() } as never,
				{ findOneByIdString: jest.fn().mockResolvedValue({ id: 'host-1' }) } as never,
				{ findOneByIdString: jest.fn().mockResolvedValue({ id: 'org-1' }) } as never,
				meetingNotifications as never
			);
			const create = (input: Partial<IEmployeeAppointmentCreateInput>) =>
				handler.execute(
					new EmployeeAppointmentCreateCommand(
						{
							agenda: 'Sprint review',
							organizationId: 'org-1',
							employeeId: 'host-1',
							startDateTime: START,
							endDateTime: END,
							...input
						} as IEmployeeAppointmentCreateInput,
						LanguagesEnum.ENGLISH
					)
				);
			return { employeeAppointmentService, meetingNotifications, create };
		};

		it('stores the invitees it names and tells each one, as the host', async () => {
			const { meetingNotifications, create } = setup();

			await create({ inviteeEmployeeIds: ['invitee-1', 'invitee-2'] });

			expect(meetingNotifications.checkedInviteeIdsOf).toHaveBeenCalledWith(
				['invitee-1', 'invitee-2'],
				{ organizationId: 'org-1', tenantId: 'tenant-1' },
				'host-1'
			);
			const meeting = expect.objectContaining({ id: 'appointment-1', tenantId: 'tenant-1', organizationId: 'org-1' });
			expect(meetingNotifications.replaceInvitees).toHaveBeenCalledWith(meeting, ['invitee-1', 'invitee-2']);
			expect(meetingNotifications.notify).toHaveBeenCalledWith('invited', meeting, ['invitee-1', 'invitee-2'], {
				sentByEmployeeId: 'host-1'
			});
		});

		it('creates nothing when an invitee is refused', async () => {
			const meetingNotifications = meetingNotificationsDouble();
			meetingNotifications.checkedInviteeIdsOf.mockRejectedValue(new BadRequestException('not of the organization'));
			const { employeeAppointmentService, create } = setup(meetingNotifications);

			await expect(create({ inviteeEmployeeIds: ['stranger'] })).rejects.toBeInstanceOf(BadRequestException);

			expect(employeeAppointmentService.create).not.toHaveBeenCalled();
		});

		it('invites nobody when the request names no invitees', async () => {
			const { meetingNotifications, create } = setup();

			await create({});

			expect(meetingNotifications.checkedInviteeIdsOf).not.toHaveBeenCalled();
			expect(meetingNotifications.replaceInvitees).not.toHaveBeenCalled();
			expect(meetingNotifications.notify).not.toHaveBeenCalled();
		});
	});

	describe('update', () => {
		const stored = {
			id: 'appointment-1',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			employeeId: 'host-1',
			agenda: 'Sprint review',
			description: null,
			location: 'https://app.ever.team/meet/jitsi?room=abc',
			startDateTime: START,
			endDateTime: END,
			status: null as EmployeeAppointmentStatus | null
		};
		const setup = (
			invited: string[],
			before: Partial<typeof stored> = {},
			organization?: { id: string; tenantId: string }
		) => {
			const meetingNotifications = meetingNotificationsDouble(invited);
			// The stored meeting: the update writes its patch there, and a read answers it as it is then
			const current: Record<string, unknown> = { ...stored, ...before };
			const employeeAppointmentService = {
				findOneByIdString: jest.fn(async () => ({ ...current })),
				update: jest.fn(async (_id: string, patch: Record<string, unknown>) => {
					Object.assign(current, patch);
					return {};
				})
			};
			const handler = new EmployeeAppointmentUpdateHandler(
				employeeAppointmentService as never,
				{ findOneByIdString: jest.fn() } as never,
				{ findOneByIdString: jest.fn().mockResolvedValue(organization) } as never,
				meetingNotifications as never
			);
			const update = (data: Partial<IEmployeeAppointmentUpdateInput>) =>
				handler.execute(new EmployeeAppointmentUpdateCommand('appointment-1', data as IEmployeeAppointmentUpdateInput));
			const kinds = () =>
				meetingNotifications.notify.mock.calls.map(([kind, , receivers]) => [kind, receivers] as [string, string[]]);
			return { meetingNotifications, employeeAppointmentService, update, kinds, current };
		};

		it('invites the added, tells the removed, and tells the kept what changed', async () => {
			const { update, kinds, meetingNotifications } = setup(['kept-1', 'removed-1']);

			await update({ inviteeEmployeeIds: ['kept-1', 'added-1'], startDateTime: new Date('2030-11-12T14:00:00.000Z') });

			expect(meetingNotifications.replaceInvitees).toHaveBeenCalledWith(expect.objectContaining({ id: 'appointment-1' }), [
				'kept-1',
				'added-1'
			]);
			expect(kinds()).toEqual([
				['invited', ['added-1']],
				['removed', ['removed-1']],
				['changed', ['kept-1']]
			]);
			const changed = meetingNotifications.notify.mock.calls.find(([kind]) => kind === 'changed');
			expect(changed?.[1]).toEqual(expect.objectContaining({ startDateTime: new Date('2030-11-12T14:00:00.000Z') }));
			expect(changed?.[3]).toEqual({ sentByEmployeeId: 'host-1' });
		});

		it('tells the invitees of a change without touching them when the request names none', async () => {
			const { update, kinds, meetingNotifications } = setup(['invitee-1']);

			await update({ location: 'Room 4' });

			expect(meetingNotifications.replaceInvitees).not.toHaveBeenCalled();
			expect(kinds()).toEqual([
				['invited', []],
				['removed', []],
				['changed', ['invitee-1']]
			]);
		});

		it('tells nothing about an edit that changes neither when, where nor what the meeting is', async () => {
			const { update, kinds } = setup(['invitee-1']);

			await update({ bufferTimeInMins: 5 });

			expect(kinds().filter(([kind]) => kind === 'changed')).toEqual([]);
		});

		it('tells everyone invited that the meeting is cancelled, and nothing else', async () => {
			const { update, kinds } = setup(['invitee-1', 'invitee-2']);

			await update({ status: EmployeeAppointmentStatus.CANCELLED });

			expect(kinds()).toEqual([['cancelled', ['invitee-1', 'invitee-2']]]);
		});

		it('tells nobody anything about a meeting already cancelled', async () => {
			const { update, kinds } = setup(['invitee-1'], { status: EmployeeAppointmentStatus.CANCELLED });

			await update({ status: EmployeeAppointmentStatus.CANCELLED, agenda: 'Renamed' });

			expect(kinds()).toEqual([]);
		});

		it('updates as before, telling nobody, a meeting the caller may not read', async () => {
			const { update, employeeAppointmentService, meetingNotifications } = setup(['invitee-1']);
			employeeAppointmentService.findOneByIdString.mockRejectedValue(new NotFoundException('not found'));

			await update({ agenda: 'Renamed', inviteeEmployeeIds: ['invitee-2'] });

			expect(employeeAppointmentService.update).toHaveBeenCalledWith('appointment-1', { agenda: 'Renamed' });
			expect(meetingNotifications.checkedInviteeIdsOf).not.toHaveBeenCalled();
			expect(meetingNotifications.notify).not.toHaveBeenCalled();
		});

		it('writes nothing when the meeting cannot be read for another reason than its absence', async () => {
			const { update, employeeAppointmentService, meetingNotifications } = setup(['invitee-1']);
			employeeAppointmentService.findOneByIdString.mockRejectedValue(new Error('connection lost'));

			await expect(update({ inviteeEmployeeIds: ['invitee-2'] })).rejects.toThrow('connection lost');

			expect(employeeAppointmentService.update).not.toHaveBeenCalled();
			expect(meetingNotifications.replaceInvitees).not.toHaveBeenCalled();
			expect(meetingNotifications.notify).not.toHaveBeenCalled();
		});

		it('stores the invitees under the organization the update moves the meeting to', async () => {
			const { update, meetingNotifications } = setup(['invitee-1'], {}, { id: 'org-2', tenantId: 'tenant-1' });

			await update({ organizationId: 'org-2', inviteeEmployeeIds: ['invitee-1', 'invitee-2'] });

			expect(meetingNotifications.checkedInviteeIdsOf).toHaveBeenCalledWith(
				['invitee-1', 'invitee-2'],
				{ organizationId: 'org-2', tenantId: 'tenant-1' },
				'host-1'
			);
			expect(meetingNotifications.replaceInvitees).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'appointment-1', organizationId: 'org-2', tenantId: 'tenant-1' }),
				['invitee-1', 'invitee-2']
			);
		});

		it('checks and stores the invitees under the organization the meeting keeps when the caller may not move it', async () => {
			// A caller confined to their organization: the service drops a move to another one from the write
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', lastOrganizationId: 'org-1' } as never);
			jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
			const { update, meetingNotifications, employeeAppointmentService, current } = setup(['invitee-1'], {}, {
				id: 'org-2',
				tenantId: 'tenant-1'
			});
			employeeAppointmentService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
				const written = { ...patch };
				delete written['organizationId'];
				Object.assign(current, written);
				return {};
			});

			await update({ organizationId: 'org-2', inviteeEmployeeIds: ['invitee-1', 'invitee-2'] });

			expect(meetingNotifications.checkedInviteeIdsOf).toHaveBeenCalledWith(
				['invitee-1', 'invitee-2'],
				{ organizationId: 'org-1', tenantId: 'tenant-1' },
				'host-1'
			);
			expect(meetingNotifications.replaceInvitees).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'appointment-1', organizationId: 'org-1' }),
				['invitee-1', 'invitee-2']
			);
		});

		it('tells the invitees of the meeting as stored after the write, not as read before it', async () => {
			const { update, meetingNotifications, employeeAppointmentService, current } = setup(['invitee-1']);
			const later = new Date('2030-11-12T15:00:00.000Z');
			// Another request moves the meeting between this one's read and its write
			employeeAppointmentService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
				Object.assign(current, { startDateTime: later }, patch);
				return {};
			});

			await update({ location: 'Room 4' });

			const changed = meetingNotifications.notify.mock.calls.find(([kind]) => kind === 'changed');
			expect(changed?.[1]).toEqual(expect.objectContaining({ location: 'Room 4', startDateTime: later }));
		});

		it('invites everyone invited when the update puts a cancelled meeting back on', async () => {
			const { update, kinds } = setup(['kept-1'], { status: EmployeeAppointmentStatus.CANCELLED });

			await update({ status: EmployeeAppointmentStatus.SCHEDULED, inviteeEmployeeIds: ['kept-1', 'added-1'] });

			expect(kinds()).toEqual([['invited', ['added-1', 'kept-1']]]);
		});

		it('writes nothing when an invitee is refused', async () => {
			const { update, employeeAppointmentService, meetingNotifications } = setup([]);
			meetingNotifications.checkedInviteeIdsOf.mockRejectedValue(new BadRequestException('not of the organization'));

			await expect(update({ inviteeEmployeeIds: ['stranger'] })).rejects.toBeInstanceOf(BadRequestException);

			expect(employeeAppointmentService.update).not.toHaveBeenCalled();
		});
	});

	describe('deletion', () => {
		const setup = (appointment: Record<string, unknown> | null, invited: string[]) => {
			const meetingNotifications = meetingNotificationsDouble(invited);
			const employeeAppointmentService = {
				findOneByIdString: appointment
					? jest.fn().mockResolvedValue(appointment)
					: jest.fn().mockRejectedValue(new NotFoundException('not found')),
				delete: jest.fn().mockResolvedValue({ affected: 1 }),
				softRemove: jest.fn().mockResolvedValue({})
			};
			const controller = new EmployeeAppointmentController(
				employeeAppointmentService as never,
				{} as never,
				meetingNotifications as never
			);
			return { controller, employeeAppointmentService, meetingNotifications };
		};
		const appointment = {
			id: 'appointment-1',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			employeeId: 'host-1',
			agenda: 'Sprint review',
			startDateTime: START,
			endDateTime: END,
			status: null
		};

		it('tells everyone invited, once the meeting is deleted, that it is cancelled', async () => {
			const { controller, employeeAppointmentService, meetingNotifications } = setup(appointment, ['invitee-1']);

			await controller.delete('appointment-1');

			expect(employeeAppointmentService.delete).toHaveBeenCalled();
			expect(meetingNotifications.notify).toHaveBeenCalledWith(
				'cancelled',
				expect.objectContaining({ id: 'appointment-1', agenda: 'Sprint review' }),
				['invitee-1'],
				{ sentByEmployeeId: 'host-1' }
			);
			expect(employeeAppointmentService.delete.mock.invocationCallOrder[0]).toBeLessThan(
				meetingNotifications.notify.mock.invocationCallOrder[0]
			);
		});

		it('tells the same on a soft deletion', async () => {
			const { controller, meetingNotifications } = setup(appointment, ['invitee-1']);

			await controller.softRemove('appointment-1');

			expect(meetingNotifications.notify).toHaveBeenCalledWith('cancelled', expect.anything(), ['invitee-1'], {
				sentByEmployeeId: 'host-1'
			});
		});

		it('tells nobody when the deletion fails, the meeting was cancelled already, or the caller may not read it', async () => {
			const failing = setup(appointment, ['invitee-1']);
			failing.employeeAppointmentService.delete.mockRejectedValue(new Error('refused'));
			await expect(failing.controller.delete('appointment-1')).rejects.toThrow('refused');
			expect(failing.meetingNotifications.notify).not.toHaveBeenCalled();

			const cancelled = setup({ ...appointment, status: EmployeeAppointmentStatus.CANCELLED }, ['invitee-1']);
			await cancelled.controller.delete('appointment-1');
			expect(cancelled.meetingNotifications.notify).not.toHaveBeenCalled();

			const hidden = setup(null, ['invitee-1']);
			await hidden.controller.delete('appointment-1');
			expect(hidden.employeeAppointmentService.delete).toHaveBeenCalled();
			expect(hidden.meetingNotifications.notify).not.toHaveBeenCalled();
		});

		it('deletes nothing when the meeting or its invitees cannot be read for another reason than its absence', async () => {
			const unread = setup(appointment, ['invitee-1']);
			unread.employeeAppointmentService.findOneByIdString.mockRejectedValue(new Error('connection lost'));
			await expect(unread.controller.delete('appointment-1')).rejects.toThrow('connection lost');
			expect(unread.employeeAppointmentService.delete).not.toHaveBeenCalled();

			const uninvited = setup(appointment, ['invitee-1']);
			uninvited.meetingNotifications.inviteeIdsOf.mockRejectedValue(new Error('connection lost'));
			await expect(uninvited.controller.softRemove('appointment-1')).rejects.toThrow('connection lost');
			expect(uninvited.employeeAppointmentService.softRemove).not.toHaveBeenCalled();
			expect(uninvited.meetingNotifications.notify).not.toHaveBeenCalled();
		});
	});

	describe('the meetings the caller is invited to', () => {
		it("lists the caller's own invitations, and none for a caller with no employee record", async () => {
			const meetingNotifications = { invitationsOf: jest.fn().mockResolvedValue([{ id: 'appointment-1' }]) };
			const controller = new EmployeeAppointmentController({} as never, {} as never, meetingNotifications as never);

			expect(await controller.findInvitations({ startDate: '2030-11-01' })).toEqual([{ id: 'appointment-1' }]);
			expect(meetingNotifications.invitationsOf).toHaveBeenCalledWith('host-1', 'tenant-1', {
				startDate: '2030-11-01',
				endDate: undefined
			});

			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);
			expect(await controller.findInvitations({})).toEqual([]);
		});
	});
});
