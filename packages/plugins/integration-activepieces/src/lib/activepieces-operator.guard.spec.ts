/**
 * The platform-wide Activepieces routes act under the installation's platform key with no tenant project pinned:
 * only the operator of the installation (a super admin listed in `EVER_OPERATOR_USER_IDS`) passes.
 */
const mockIsInstallationOperator = jest.fn();

jest.mock('@gauzy/core', () => ({
	isInstallationOperator: () => mockIsInstallationOperator()
}));

import { ForbiddenException } from '@nestjs/common';
import { ACTIVEPIECES_OPERATOR_ONLY, ActivepiecesOperatorGuard } from './activepieces-operator.guard';

describe('ActivepiecesOperatorGuard', () => {
	const guard = new ActivepiecesOperatorGuard();

	afterEach(() => mockIsInstallationOperator.mockReset());

	it('lets the operator of the installation through', () => {
		mockIsInstallationOperator.mockReturnValue(true);

		expect(guard.canActivate({} as any)).toBe(true);
	});

	it('refuses anyone else, a tenant super admin included', () => {
		mockIsInstallationOperator.mockReturnValue(false);

		let refusal: unknown;
		try {
			guard.canActivate({} as any);
		} catch (error) {
			refusal = error;
		}

		expect(refusal).toBeInstanceOf(ForbiddenException);
		expect((refusal as ForbiddenException).getResponse()).toEqual(
			expect.objectContaining({ code: ACTIVEPIECES_OPERATOR_ONLY })
		);
	});
});
