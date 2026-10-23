import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { EmailTemplateEnum, LanguagesEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { EmailTemplateService } from './email-template.service';

/**
 * `EmailTemplateService.saveTemplate` ran the lookup and the update in one `try`, and its `catch`
 * created a new template. A failed update therefore inserted a second template with the same name,
 * language, organization and tenant. Only a miss now leads to a create.
 */
describe('EmailTemplateService.saveTemplate', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'org-1';

	let service: EmailTemplateService;
	let create: jest.SpyInstance;
	let findOneByWhereOptions: jest.Mock;

	const save = () =>
		service.saveTemplate(
			LanguagesEnum.ENGLISH,
			EmailTemplateEnum.WELCOME_USER,
			'subject',
			ORGANIZATION,
			TENANT,
			{ hbs: 'Welcome {{name}}' } as any
		);

	beforeEach(() => {
		service = Object.create(EmailTemplateService.prototype);
		findOneByWhereOptions = jest.fn();
		(service as any).findOneByWhereOptions = findOneByWhereOptions;
		create = jest.spyOn(CrudService.prototype, 'create');
	});

	afterEach(() => jest.restoreAllMocks());

	it('updates the existing template and propagates a failed update without creating a second one', async () => {
		const existing = {
			id: 'template-1',
			name: `${EmailTemplateEnum.WELCOME_USER}/subject`,
			languageCode: LanguagesEnum.ENGLISH,
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			hbs: 'Old subject'
		};
		findOneByWhereOptions.mockResolvedValue(existing);
		create.mockRejectedValue(new Error('update failed'));

		await expect(save()).rejects.toThrow('update failed');

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'template-1', hbs: 'Welcome {{name}}' }));
	});

	it('creates the template once when none exists', async () => {
		findOneByWhereOptions.mockRejectedValue(new NotFoundException());
		create.mockImplementation(async (entity: any) => entity);

		const saved = await save();

		expect(create).toHaveBeenCalledTimes(1);
		const [entity] = create.mock.calls[0];
		expect(entity.id).toBeUndefined();
		expect(entity).toEqual(
			expect.objectContaining({
				name: `${EmailTemplateEnum.WELCOME_USER}/subject`,
				languageCode: LanguagesEnum.ENGLISH,
				organizationId: ORGANIZATION,
				tenantId: TENANT,
				hbs: 'Welcome {{name}}'
			})
		);
		expect(saved).toBe(entity);
	});

	it('does not create a template when the lookup itself fails', async () => {
		findOneByWhereOptions.mockRejectedValue(new Error('connection lost'));

		await expect(save()).rejects.toThrow('connection lost');
		expect(create).not.toHaveBeenCalled();
	});
});
