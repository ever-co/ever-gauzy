import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line no-restricted-imports -- CONTROL arm only: the pre-fix compiler call
import * as rawMjml2html from 'mjml';
import { EmailTemplateEnum, LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmailTemplateSaveCommand } from '../email-template.save.command';

// The handler's `new EmailTemplate()` would otherwise pull the whole entity graph into this suite.
jest.mock('../../email-template.entity', () => ({ EmailTemplate: class EmailTemplate {} }));
jest.mock('../../email-template.service', () => ({ EmailTemplateService: class EmailTemplateService {} }));

import * as compileMjmlModule from '../../compile-mjml';
import { EmailTemplateSaveHandler } from './email-template.save.handler';

/**
 * GHSA-48h9-vwf5-h8m7 (persistent variant) — `POST /email-template/template/save` compiled the
 * submitted MJML with includes enabled and stored the result in `hbs`, which is served back by
 * `GET /email-template/:id` and used for real outgoing email.
 */
describe('EmailTemplateSaveHandler (GHSA-48h9-vwf5-h8m7)', () => {
	const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const MARKER = `SAVE-LFI-${process.pid}-${Date.now()}`;
	let dir: string;
	let secretFile: string;

	const includePayload = () =>
		`<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{name}}</mj-text><mj-include path="${secretFile}" type="html" /></mj-column></mj-section></mj-body></mjml>`;

	const command = () =>
		new EmailTemplateSaveCommand({
			languageCode: LanguagesEnum.ENGLISH,
			name: EmailTemplateEnum.WELCOME_USER,
			organizationId: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
			tenantId: TENANT_ID,
			mjml: includePayload(),
			subject: 'Welcome {{name}}'
		} as any);

	beforeAll(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-save-'));
		secretFile = path.join(dir, 'passwd');
		fs.writeFileSync(secretFile, `root:${MARKER}`);
	});

	afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID));

	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	const run = async (found: boolean) => {
		const service = {
			findOneOrFailByWhereOptions: jest.fn(async () =>
				found ? { success: true, record: { id: 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0' } } : { success: false }
			),
			create: jest.fn(async (entity: any) => entity),
			update: jest.fn(async () => ({}))
		};
		await new EmailTemplateSaveHandler(service as any).execute(command());
		const writes = found
			? service.update.mock.calls.map((call: any[]) => call[1])
			: service.create.mock.calls.map((call: any[]) => call[0]);
		return writes.find((entity: any) => entity.mjml !== undefined);
	};

	it.each([
		['create', false],
		['update', true]
	])('%s branch: never persists included file bytes in hbs', async (_branch, found) => {
		const html = await run(found as boolean);

		expect(html.mjml).toBe(includePayload());
		expect(html.hbs).toContain('Hi {{name}}');
		expect(html.hbs).not.toContain(MARKER);
	});

	it('CONTROL: with the pre-fix compiler call the file bytes are persisted', async () => {
		jest.spyOn(compileMjmlModule, 'compileMjml').mockImplementation((source: unknown) => rawMjml2html(source));

		const html = await run(false);

		expect(html.hbs).toContain(MARKER);
	});
});
