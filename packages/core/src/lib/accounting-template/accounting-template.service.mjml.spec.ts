import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as Handlebars from 'handlebars';
// eslint-disable-next-line no-restricted-imports -- CONTROL arm only: the pre-fix compiler call
import * as rawMjml2html from 'mjml';
import { AccountingTemplateTypeEnum, LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';

import * as compileMjmlModule from '../email-template/compile-mjml';
import { AccountingTemplateService } from './accounting-template.service';

/**
 * GHSA-48h9-vwf5-h8m7 — the accounting template preview and save paths compiled caller MJML with
 * includes enabled. Preview returned the included file's bytes; save persisted them in `hbs` (and
 * the update branch compiled the previously stored `record.mjml` instead of the submitted one).
 */
describe('AccountingTemplateService MJML compilation (GHSA-48h9-vwf5-h8m7)', () => {
	const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const ORGANIZATION_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
	const MARKER = `ACCOUNTING-LFI-${process.pid}-${Date.now()}`;
	let dir: string;
	let secretFile: string;
	let service: AccountingTemplateService;

	const includePayload = () =>
		`<mjml><mj-body><mj-section><mj-column><mj-text>Invoice from {{from}}</mj-text><mj-include path="${secretFile}" type="html" /></mj-column></mj-section></mj-body></mjml>`;
	const plain = (text: string) =>
		`<mjml><mj-body><mj-section><mj-column><mj-text>${text}</mj-text></mj-column></mj-section></mj-body></mjml>`;

	beforeAll(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-accounting-'));
		secretFile = path.join(dir, '.env');
		fs.writeFileSync(secretFile, `JWT_SECRET=${MARKER}`);
	});

	afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

	beforeEach(() => {
		service = new AccountingTemplateService(
			{ metadata: { hasColumnWithPropertyPath: () => true } } as any,
			{} as any
		);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('generatePreview', () => {
		it('does not return the bytes of an <mj-include>d file', () => {
			const { html } = service.generatePreview({ request: { data: includePayload(), organization: 'Acme' } });

			expect(html).not.toContain(MARKER);
			expect(html).toContain('Invoice from Acme');
		});

		it('CONTROL: with the pre-fix compiler call the same request leaks the file', () => {
			jest.spyOn(compileMjmlModule, 'compileMjml').mockImplementation((source: unknown) => rawMjml2html(source));

			const { html } = service.generatePreview({ request: { data: includePayload(), organization: 'Acme' } });

			expect(html).toContain(MARKER);
		});

		it('treats a JSON object `data` as text, never as a Handlebars AST', () => {
			const ast = Handlebars.parse('AST-MARKER {{from}}');
			// CONTROL: Handlebars would have compiled the object as a program.
			expect(Handlebars.compile(ast as any)({ from: 'Acme' })).toBe('AST-MARKER Acme');

			const { html } = service.generatePreview({ request: { data: ast, organization: 'Acme' } });
			expect(html).not.toContain('AST-MARKER');
		});
	});

	describe('saveTemplate', () => {
		const input = (mjml: string) => ({
			languageCode: LanguagesEnum.ENGLISH,
			templateType: AccountingTemplateTypeEnum.INVOICE,
			organizationId: ORGANIZATION_ID,
			tenantId: TENANT_ID,
			mjml
		});

		it('create branch: never persists included file bytes in hbs', async () => {
			jest.spyOn(service, 'findOneByWhereOptions').mockRejectedValue(new Error('not found'));
			const create = jest.spyOn(service, 'create').mockImplementation(async (entity: any) => entity);

			await service.saveTemplate(input(includePayload()));

			const saved = create.mock.calls[0][0] as any;
			expect(saved.mjml).toBe(includePayload());
			expect(saved.hbs).not.toContain(MARKER);
			expect(saved.hbs).toContain('Invoice from {{from}}');
		});

		it('update branch: compiles the SUBMITTED mjml, without includes', async () => {
			const record = {
				id: 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0',
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				mjml: plain('OLD-VERSION')
			};
			jest.spyOn(service, 'findOneByWhereOptions').mockResolvedValue(record as any);
			const update = jest.spyOn(service, 'update').mockResolvedValue({} as any);

			await service.saveTemplate(input(plain('NEW-VERSION')));

			const [, entity] = update.mock.calls[0] as [string, any];
			expect(entity.mjml).toBe(plain('NEW-VERSION'));
			expect(entity.hbs).toContain('NEW-VERSION');
			// CONTROL: the pre-fix code compiled `record.mjml`, whose html is the OLD version.
			expect(rawMjml2html(record.mjml).html).toContain('OLD-VERSION');
			expect(entity.hbs).not.toContain('OLD-VERSION');

			// And an include submitted on update is not followed either.
			await service.saveTemplate(input(includePayload()));
			const [, second] = update.mock.calls[1] as [string, any];
			expect(second.hbs).not.toContain(MARKER);
		});

		it('rejects unparseable mjml before it touches the database', async () => {
			const find = jest.spyOn(service, 'findOneByWhereOptions').mockResolvedValue({
				id: 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0',
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				mjml: plain('OLD-VERSION')
			} as any);
			const update = jest.spyOn(service, 'update').mockResolvedValue({} as any);
			const create = jest.spyOn(service, 'create').mockImplementation(async (entity: any) => entity);

			// mjml throws on markup it cannot parse, and the submitted mjml is now what gets compiled.
			await expect(service.saveTemplate(input('not mjml at all'))).rejects.toThrow();

			// CONTROL: while the compile sat INSIDE the try, that throw was swallowed by the catch that
			// means "this organization has no template yet", so the lookup ran and the insert branch was
			// entered (it only re-threw because it happened to compile a second time).
			expect(find).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
			expect(create).not.toHaveBeenCalled();
		});
	});
});
