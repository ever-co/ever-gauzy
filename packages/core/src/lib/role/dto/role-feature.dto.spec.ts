/**
 * This import must stay FIRST: the entity graph has to finish initializing before anything applies
 * the custom validators (pre-existing circular import; see invite-accept.security.spec.ts).
 */
import '../../core/entities/internal';
import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, validate, ValidateIf, ValidationError } from 'class-validator';
import { RequestContext } from '../../core/context';
import { CreateUserDTO } from '../../user/dto/create-user.dto';
import { UpdateUserDTO } from '../../user/dto/update-user.dto';
import { CreateInviteDTO } from '../../invite/dto/create-invite.dto';

/**
 * GHSA-x4mv-fhwj-g3rp — the edge half of the fix: `RoleFeatureDTO.role` (inherited by the user
 * create/update, register and invite DTOs) accepts only an object carrying a UUID `id`.
 *
 * Only the `isRoleReference` constraint is asserted here. `IsRoleShouldExist` needs a database and
 * reports its own error; it is left to fail closed (no tenant context in this test).
 */
const EMP = '44444444-4444-4444-8444-444444444444';
const SA = '55555555-5555-4555-8555-555555555555';

/** Constraint names reported for `role`, across the (possibly nested) validation errors. */
function roleConstraints(errors: ValidationError[]): string[] {
	return errors.filter((error) => error.property === 'role').flatMap((error) => Object.keys(error.constraints ?? {}));
}

async function validateAs(cls: any, payload: Record<string, unknown>): Promise<ValidationError[]> {
	return validate(plainToInstance(cls, payload) as object);
}

describe('RoleFeatureDTO.role (GHSA-x4mv-fhwj-g3rp)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined as any);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('CONTROL: the pre-fix declaration', () => {
		/** Verbatim copy of the old `role` decorators, minus the database-backed existence check. */
		class PreFixRoleFeatureDTO {
			@ValidateIf((it) => !it.role)
			@IsNotEmpty()
			readonly roleId: string;

			@ValidateIf((it) => !it.roleId)
			@IsNotEmpty()
			readonly role: unknown;
		}

		it('accepted a bare id string as the role', async () => {
			expect(roleConstraints(await validateAs(PreFixRoleFeatureDTO, { role: SA }))).toEqual([]);
		});

		it('skipped every validator on role whenever roleId was present', async () => {
			expect(roleConstraints(await validateAs(PreFixRoleFeatureDTO, { roleId: EMP, role: 42 }))).toEqual([]);
		});
	});

	describe.each([
		['CreateUserDTO', CreateUserDTO],
		['UpdateUserDTO', UpdateUserDTO],
		['CreateInviteDTO', CreateInviteDTO]
	])('%s', (_name, dto) => {
		it.each([[SA], [42], [[SA]], [{}], [{ id: 'not-a-uuid' }]])('refuses role %p', async (role) => {
			expect(roleConstraints(await validateAs(dto, { role }))).toContain('isRoleReference');
		});

		it('validates role even when roleId is present', async () => {
			expect(roleConstraints(await validateAs(dto, { roleId: EMP, role: SA }))).toContain('isRoleReference');
		});

		it('accepts the role object the UI sends', async () => {
			const errors = await validateAs(dto, { role: { id: EMP, name: 'EMPLOYEE', tenantId: EMP } });
			expect(roleConstraints(errors)).not.toContain('isRoleReference');
		});

		it('leaves role alone when only roleId is sent', async () => {
			for (const role of [undefined, null]) {
				expect(roleConstraints(await validateAs(dto, { roleId: EMP, role }))).toEqual([]);
			}
		});
	});
});
