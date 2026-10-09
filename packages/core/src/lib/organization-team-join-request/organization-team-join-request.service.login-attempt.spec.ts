import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { LoginAttempt, LoginAttemptScope } from '../auth/login-attempt.service';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

/**
 * How team join-request validation settles its per-email attempt.
 *
 * The confirmation code is the credential here. A wrong code is a guess and counts against the email;
 * a request that carried no code or token at all guessed nothing, and counting it would let a buggy
 * client lock an email out of the join flow.
 */
describe('OrganizationTeamJoinRequestService.validateJoinRequest attempt settlement', () => {
	let attempt: { [K in keyof LoginAttempt]: jest.Mock };
	let loginAttemptService: { begin: jest.Mock };
	let getOneOrFail: jest.Mock;
	let service: OrganizationTeamJoinRequestService;

	beforeEach(() => {
		attempt = {
			fail: jest.fn(async () => undefined),
			succeed: jest.fn(async () => undefined),
			release: jest.fn(async () => undefined)
		};
		loginAttemptService = { begin: jest.fn(async () => attempt) };
		getOneOrFail = jest.fn();

		const queryBuilder = {
			setFindOptions: jest.fn(),
			where: jest.fn((build: (qb: { andWhere: jest.Mock }) => void) => {
				build({ andWhere: jest.fn() });
				return queryBuilder;
			}),
			getOneOrFail
		};

		service = Object.create(OrganizationTeamJoinRequestService.prototype);
		Object.assign(service, {
			_loginAttemptService: loginAttemptService,
			typeOrmRepository: {
				metadata: { tableName: 'organization_team_join_request' },
				createQueryBuilder: jest.fn(() => queryBuilder)
			}
		});
	});

	it('counts a code that matches no pending request as a failure', async () => {
		getOneOrFail.mockRejectedValue(new EntityNotFoundError(OrganizationTeamJoinRequest, {}));

		await expect(
			service.validateJoinRequest({ email: 'victim@ever.co', code: 'ZZZZZZ', organizationTeamId: 't1' } as any)
		).rejects.toBeInstanceOf(BadRequestException);

		expect(loginAttemptService.begin).toHaveBeenCalledWith(LoginAttemptScope.TEAM_JOIN_CODE, 'victim@ever.co');
		expect(attempt.fail).toHaveBeenCalledTimes(1);
		expect(attempt.release).not.toHaveBeenCalled();
	});

	it('gives the slot back when neither a code nor a token was supplied', async () => {
		await expect(
			service.validateJoinRequest({ email: 'victim@ever.co', organizationTeamId: 't1' } as any)
		).rejects.toBeInstanceOf(BadRequestException);

		expect(getOneOrFail).not.toHaveBeenCalled();
		expect(attempt.fail).not.toHaveBeenCalled();
		expect(attempt.release).toHaveBeenCalledTimes(1);
	});
});
