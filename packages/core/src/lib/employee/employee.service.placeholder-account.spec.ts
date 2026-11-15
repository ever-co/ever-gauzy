import '../core/entities/internal';
import { ConflictException } from '@nestjs/common';
import { EmployeeService } from './employee.service';

/**
 * The account behind a member without an account (ever-co/ever-gauzy#11913) is made for that member alone: it never
 * signs in, and a claim or a merge retires it with the member. No person is filed for it.
 */
describe('EmployeeService.assertNotPlaceholderAccount', () => {
	const TENANT = 'tenant-1';

	function build(placeholderUserIds: string[]) {
		// The placeholders on each account; 'user-removed-placeholder' stands behind a soft-removed one.
		const count = jest.fn(async ({ where, withDeleted }) => {
			const live = placeholderUserIds.includes(where.userId);
			const removed = where.userId === 'user-removed-placeholder' && withDeleted === true;
			return where.isPlaceholder === true && where.tenantId === TENANT && (live || removed) ? 1 : 0;
		});
		const service: EmployeeService = Object.create(EmployeeService.prototype);
		Object.assign(service, { typeOrmRepository: { count } });
		return { service, count };
	}

	it('answers 409 for the account behind a member without an account', async () => {
		const { service, count } = build(['user-placeholder']);

		await expect(service.assertNotPlaceholderAccount('user-placeholder', TENANT)).rejects.toBeInstanceOf(
			ConflictException
		);
		expect(count).toHaveBeenCalledWith({
			where: { userId: 'user-placeholder', tenantId: TENANT, isPlaceholder: true },
			withDeleted: true
		});
	});

	it('answers 409 for the account behind a removed placeholder, which a recovery would bring back', async () => {
		const { service } = build([]);

		await expect(service.assertNotPlaceholderAccount('user-removed-placeholder', TENANT)).rejects.toBeInstanceOf(
			ConflictException
		);
	});

	it('lets any other account through', async () => {
		const { service } = build(['user-placeholder']);

		await expect(service.assertNotPlaceholderAccount('user-person', TENANT)).resolves.toBeUndefined();
	});
});
