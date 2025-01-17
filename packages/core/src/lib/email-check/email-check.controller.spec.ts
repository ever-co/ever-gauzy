import { Test, TestingModule } from '@nestjs/testing';
import { EmailCheckController } from './email-check.controller';
import { EmailCheckService } from './email-check.service';

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
		}).compile();

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

	it('should handle invalid email format', async () => {
		const email = 'invalid-email';

		// Expect a validation error when calling the controller
		await expect(controller.checkEmail({ email })).rejects.toThrow();
	});

	it('should handle empty email field', async () => {
		const email = '';

		// Expect a validation error for empty email
		await expect(controller.checkEmail({ email })).rejects.toThrow();
	});
});
