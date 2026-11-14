import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { LanguagesEnum } from '@gauzy/contracts';
import { compileMjml } from './compile-mjml';

/**
 * The default email templates as they ship (`core/seeds/data/default-email-templates/<template>/<language>/`).
 *
 * Two things went wrong in them unnoticed. A translation printed a variable its English original does not have
 * (`candidateName` for `name` in the timesheet emails, `generatedUrl` for `acceptUrl` in the estimate), which no
 * sender passes, so the sentence came out with a hole in it. And a template with an MJML validation error still
 * seeds, but the editor's preview shows its MJML source instead of the email (the preview falls back to the source
 * on any error). Both are checked here for every template in every language.
 */
describe('default email templates', () => {
	const ROOT = path.join(__dirname, '../core/seeds/data/default-email-templates');
	const FALLBACK = LanguagesEnum.ENGLISH;

	const templates = fs
		.readdirSync(ROOT, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	const languagesOf = (template: string): string[] =>
		fs
			.readdirSync(path.join(ROOT, template), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();

	const read = (template: string, language: string, file: string): string =>
		fs.readFileSync(path.join(ROOT, template, language, file), 'utf8');

	/**
	 * What a template reads from its locals: the variables it prints and the conditions and lists it opens, each
	 * with the list it is inside of (`items[].title`).
	 */
	function expressionsOf(source: string): string[] {
		const found = new Set<string>();
		const nameOf = (expression: hbs.AST.Expression): string => (expression as hbs.AST.PathExpression).original;
		const walk = (node: hbs.AST.Node | undefined, scope: string): void => {
			if (!node) {
				return;
			}
			if (node.type === 'Program') {
				(node as hbs.AST.Program).body.forEach((child) => walk(child, scope));
			} else if (node.type === 'MustacheStatement') {
				const mustache = node as hbs.AST.MustacheStatement;
				found.add(`${scope}${nameOf(mustache.path)}`.replace('[].this.', '[].'));
			} else if (node.type === 'BlockStatement') {
				const block = node as hbs.AST.BlockStatement;
				const helper = nameOf(block.path);
				const param = block.params.map(nameOf).join(' ');
				found.add(`#${helper} ${scope}${param}`.replace('[].this.', '[].'));
				const inner = helper === 'each' ? `${scope}${param}[].` : scope;
				walk(block.program, inner);
				walk(block.inverse, inner);
			}
		};
		walk(Handlebars.parse(source), '');
		return [...found].sort();
	}

	it('finds the templates', () => {
		expect(templates.length).toBeGreaterThan(30);
		expect(templates).toEqual(expect.arrayContaining(['password-less-authentication', 'invite-gauzy-teams']));
	});

	it.each(templates)('%s ships its two parts in English, the language every other falls back to', (template) => {
		expect(languagesOf(template)).toContain(FALLBACK);
		for (const language of languagesOf(template)) {
			expect(fs.readdirSync(path.join(ROOT, template, language)).sort()).toEqual(['html.mjml', 'subject.hbs']);
			expect(read(template, language, 'subject.hbs').trim()).not.toBe('');
		}
	});

	it.each(templates)('%s compiles without an MJML error in every language', async (template) => {
		for (const language of languagesOf(template)) {
			const { html, errors } = await compileMjml(read(template, language, 'html.mjml'));

			expect({ language, errors }).toEqual({ language, errors: [] });
			expect(html).toContain('</html>');
			// Handlebars renders the compiled HTML at send time: it has to parse.
			expect(() => Handlebars.precompile(html)).not.toThrow();
		}
	});

	it.each(templates)('%s reads the same variables in every language', (template) => {
		for (const file of ['html.mjml', 'subject.hbs']) {
			const english = expressionsOf(read(template, FALLBACK, file));
			for (const language of languagesOf(template)) {
				expect({ language, file, reads: expressionsOf(read(template, language, file)) }).toEqual({
					language,
					file,
					reads: english
				});
			}
		}
	});

	/**
	 * The templates whose subject named the app before the redesign (`Welcome to Gauzy ...`, `... for {{appName}}`):
	 * the name is how a reader tells which app an invitation, a code or a reset link comes from. Nothing else compares
	 * a subject with the one it replaces, so a reworded subject can lose the name unnoticed, as the invitations and the
	 * team-join request did.
	 */
	const SUBJECTS_THAT_NAME_THE_APP = [
		'account-deletion-completed',
		'account-deletion-request',
		'email-reset',
		'email-verification',
		'invite-employee',
		'invite-gauzy-teams',
		'invite-organization-client',
		'invite-user',
		'multi-tenant-password',
		'organization-team-join-request',
		'password',
		'password-less-authentication',
		'task-update',
		'welcome-user'
	];

	it.each(SUBJECTS_THAT_NAME_THE_APP)('%s names the app in its subject, in every language', (template) => {
		for (const language of languagesOf(template)) {
			expect({ language, reads: expressionsOf(read(template, language, 'subject.hbs')) }).toEqual({
				language,
				reads: expect.arrayContaining(['appName'])
			});
		}
	});
});
