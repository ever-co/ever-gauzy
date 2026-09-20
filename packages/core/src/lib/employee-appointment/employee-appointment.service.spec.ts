import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { decode, sign, verify } from 'jsonwebtoken';
import { TokenPurposeEnum, verifyPurposeToken } from '../auth/purpose-token';
import { EmployeeAppointmentService } from './employee-appointment.service';

/**
 * GHSA-28wv-vrxj-rp4q — appointment reschedule tokens.
 *
 * `GET /employee-appointment/sign/:id` signed `{ appointmentId }` with JWT_SECRET, with no type and
 * no expiry, for ANY id the caller supplied: a token-minting oracle for the other token consumers
 * (public invoice, signin.workspace). `GET /decode/:token` used `jwt.decode`, which checks no
 * signature at all.
 */
describe('EmployeeAppointmentService tokens (GHSA-28wv-vrxj-rp4q)', () => {
	const APPOINTMENT = {
		id: 'appt-1',
		tenantId: 'tenant-1',
		endDateTime: new Date(Date.now() + 3 * 24 * 3600 * 1000)
	};

	function build(visible: any[] = [APPOINTMENT]) {
		const service: EmployeeAppointmentService = Object.create(EmployeeAppointmentService.prototype);
		const findOneByIdString = jest.fn(async (id: string) => {
			const found = visible.find((appointment) => appointment.id === id);
			if (!found) {
				throw new NotFoundException();
			}
			return found;
		});
		// The tenant-scoped lookup of TenantAwareCrudService; stubbed to the caller's visible rows.
		Object.assign(service, { findOneByIdString });
		return { service, findOneByIdString };
	}

	it('signs a typed, expiring token for an appointment the caller can see', async () => {
		const { service, findOneByIdString } = build();
		const token = await service.signAppointmentId('appt-1');

		expect(findOneByIdString).toHaveBeenCalledWith('appt-1');
		const payload = verifyPurposeToken(token, TokenPurposeEnum.APPOINTMENT, { requiredClaims: ['appointmentId'] });
		expect(payload).toMatchObject({ appointmentId: 'appt-1', tenantId: 'tenant-1' });
		// Valid until a week after the appointment ends.
		expect(payload.exp * 1000).toBeGreaterThan(APPOINTMENT.endDateTime.getTime() + 6 * 24 * 3600 * 1000);
		expect(payload.exp * 1000).toBeLessThan(APPOINTMENT.endDateTime.getTime() + 8 * 24 * 3600 * 1000);
	});

	it('refuses to sign an id the caller cannot see — CONTROL: the pre-fix signer took any UUID', async () => {
		// CONTROL: the pre-fix signer was a plain sign() over the supplied id.
		const preFix = sign({ appointmentId: 'someone-elses' }, environment.JWT_SECRET, {});
		expect(verify(preFix, environment.JWT_SECRET)).toMatchObject({ appointmentId: 'someone-elses' });

		const { service } = build();
		await expect(service.signAppointmentId('someone-elses')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('decodes a token it signed', async () => {
		const { service } = build();
		const token = await service.signAppointmentId('appt-1');
		await expect(service.decodeSignToken(token)).resolves.toBe('appt-1');
	});

	it('still decodes a legacy (untyped, non-expiring) reschedule link for a visible appointment', async () => {
		const { service } = build();
		const legacy = sign({ appointmentId: 'appt-1' }, environment.JWT_SECRET, {});
		await expect(service.decodeSignToken(legacy)).resolves.toBe('appt-1');
	});

	it('rejects a forged (unsigned / foreign-key) token — CONTROL: jwt.decode accepted it', async () => {
		const forged = sign({ appointmentId: 'appt-1' }, 'attacker-secret');

		// CONTROL: the pre-fix decode checked no signature.
		expect(decode(forged)).toMatchObject({ appointmentId: 'appt-1' });

		const { service, findOneByIdString } = build();
		await expect(service.decodeSignToken(forged)).rejects.toBeInstanceOf(BadRequestException);
		expect(findOneByIdString).not.toHaveBeenCalled();
	});

	it('rejects a token of another purpose and a legacy token for an appointment the caller cannot see', async () => {
		const { service } = build();
		await expect(
			service.decodeSignToken(
				sign({ purpose: TokenPurposeEnum.INVOICE_SHARE, appointmentId: 'appt-1' }, environment.JWT_SECRET)
			)
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.decodeSignToken(sign({ appointmentId: 'someone-elses' }, environment.JWT_SECRET))
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('gives a past or undated appointment at least a day', () => {
		const now = Date.now();
		const DAY = 24 * 3600;
		expect(EmployeeAppointmentService.getRescheduleTokenLifetime(new Date(now - 30 * DAY * 1000), now)).toBe(DAY);
		expect(EmployeeAppointmentService.getRescheduleTokenLifetime(undefined, now)).toBe(DAY);
		expect(EmployeeAppointmentService.getRescheduleTokenLifetime(new Date(now + DAY * 1000), now)).toBe(8 * DAY);
	});
});
