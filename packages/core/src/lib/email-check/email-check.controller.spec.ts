/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the subject first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel first
 * lets that module finish before anything applies it. The API does not hit this because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmailCheckController } from './email-check.controller';
import { EmailCheckService } from './email-check.service';
import { CheckEmailDTO } from './dto/check-email.dto';
describe('EmailCheckController', () => {
	let controller: EmailCheckController;
	let emailCheckService: EmailCheckService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [EmailCheckController],
			providers: [
				{
					provide: EmailCheckService,
					useValue: {
						doesEmailExist: jest.fn() // Mock the service method
					}
				}
			]
		})
			/**
			 * `EmailCheckController` is guarded by `ApiKeyAuthGuard`, which injects
			 * `TenantApiKeyService`. Nest instantiates guards while building the module, so the
			 * suite could not compile even though the controller's own dependency was provided.
			 * Automock the leftovers — the guard is not what these tests are about.
			 */
			.useMocker(() => ({}))
			.compile();
		controller = module.get<EmailCheckController>(EmailCheckController);
		emailCheckService = module.get<EmailCheckService>(EmailCheckService);
	});
	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
	it('should return { exists: true } when email exists', async () => {
		const email = 'test@example.com';
		jest.spyOn(emailCheckService, 'doesEmailExist').mockResolvedValue(true);
		const result = await controller.checkEmail({ email });
		expect(result).toEqual({ exists: true });
		expect(emailCheckService.doesEmailExist).toHaveBeenCalledWith(email);
	});
	it('should return { exists: false } when email does not exist', async () => {
		const email = 'nonexistent@example.com';
		jest.spyOn(emailCheckService, 'doesEmailExist').mockResolvedValue(false);
		const result = await controller.checkEmail({ email });
		expect(result).toEqual({ exists: false });
		expect(emailCheckService.doesEmailExist).toHaveBeenCalledWith(email);
	});
	it('should handle service errors gracefully', async () => {
		const email = 'test@example.com';
		jest.spyOn(emailCheckService, 'doesEmailExist').mockRejectedValue(new Error('Database error'));
		await expect(controller.checkEmail({ email })).rejects.toThrow('Database error');
		expect(emailCheckService.doesEmailExist).toHaveBeenCalledWith(email);
	});
	/**
	 * These two cases previously called `controller.checkEmail()` directly and expected it to
	 * reject a malformed address. It never could: `checkEmail` only delegates to the service, and
	 * the rejection they asserted comes from Nest's global `ValidationPipe` running `CheckEmailDTO`
	 * — which does not execute when the method is invoked in-process. Both resolved to
	 * `{ exists: undefined }` instead of throwing.
	 *
	 * The real contract is the constraints declared on the DTO, so assert those directly. That keeps the coverage
	 * the tests were reaching for, and fails if `@IsEmail()` / `@IsNotEmpty()` is ever dropped.
	 */
	describe('CheckEmailDTO validation', () => {
		const constraintsFor = async (email: string): Promise<string[]> => {
			const errors = await validate(plainToInstance(CheckEmailDTO, { email }));
			return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
		};

		it('accepts a well-formed address', async () => {
			await expect(constraintsFor('test@example.com')).resolves.toEqual([]);
		});

		it('rejects a malformed address', async () => {
			await expect(constraintsFor('invalid-email')).resolves.toContain('isEmail');
		});

		it('rejects an empty address', async () => {
			const constraints = await constraintsFor('');

			expect(constraints).toContain('isNotEmpty');
			expect(constraints).toContain('isEmail');
		});
	});
});
