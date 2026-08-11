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
import { UserService } from '../user/user.service';
import { EmailCheckService } from './email-check.service';
describe('EmailCheckService', () => {
	let service: EmailCheckService;
	let userService: UserService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EmailCheckService,
				{
					provide: UserService,
					useValue: { count: jest.fn() }
				}
			]
		}).compile();
		service = module.get<EmailCheckService>(EmailCheckService);
		userService = module.get<UserService>(UserService);
	});
	it('should be defined', () => {
		expect(service).toBeDefined();
	});
	describe('doesEmailExist', () => {
		it('should return true when email exists', async () => {
			jest.spyOn(userService, 'count').mockResolvedValue(1);
			expect(await service.doesEmailExist('test@example.com')).toBe(true);
		});
		it('should return false when email does not exist', async () => {
			jest.spyOn(userService, 'count').mockResolvedValue(0);
			expect(await service.doesEmailExist('test@example.com')).toBe(false);
		});
		it('should handle database errors', async () => {
			jest.spyOn(userService, 'count').mockRejectedValue(new Error('DB Error'));
			await expect(service.doesEmailExist('test@example.com')).rejects.toThrow('DB Error');
		});
	});
});
