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
