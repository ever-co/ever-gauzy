/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmailTemplateController } from './email-template.controller';
import { EmailTemplateModule } from './email-template.module';
import { EmailTemplateResolver } from './email-template.resolver';
import { EmailTemplateService } from './email-template.service';
import {
	EmailTemplateGeneratePreviewQuery,
	EmailTemplateQuery,
	FindEmailTemplateQuery
} from './queries';
import { EmailTemplateSaveCommand } from './commands';

/**
 * The message templates over GraphQL.
 *
 * The delivered REST routes serve a list, a paginated list, a count, a lookup that resolves a message's
 * subject and body through the copy fallback, a document preview, a save that compiles, and the seven
 * CRUD operations the controller inherits from the base. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same query or command, that the REST
 *   route reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission are the controller's, field by field** — the controller states
 *   one permission on the class and none on any handler, so every field states that one;
 * - **the tenant-wide copy is stateable**: a row with no organization is the copy the platform answers
 *   to every organization of its tenant, and `organizationId: { isNull: true }` selects it;
 * - the two body columns are carried as the text they are rather than as a document, and the members
 *   the delivered reader cannot answer are not declared at all;
 * - a copy that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ORG_HTML = '00000000-0000-4000-8000-000000000010';
const SHARED_HTML = '00000000-0000-4000-8000-000000000011';
const ORG_HTML_GERMAN = '00000000-0000-4000-8000-000000000012';
const ORG_SUBJECT = '00000000-0000-4000-8000-000000000013';
const TENANT_WIDE_HTML = '00000000-0000-4000-8000-000000000014';

/**
 * The rows a scripted reader answers with, in the order the delivered list read returns them.
 *
 * The five rows are the whole of what a caller has to be able to tell apart on this table: an
 * organization's own copies of the two parts of one message, one of them in a second language, the
 * platform-wide copy that belongs to no tenant, and the organization-less copy a tenant filed for
 * itself. The last two are the distinction the filter's `organizationId` and `tenantId` members state.
 */
const ROWS = [
	{
		id: ORG_HTML,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'password/html',
		languageCode: LanguagesEnum.ENGLISH,
		title: 'password',
		hbs: '<html>Reset your password</html>',
		mjml: '<mjml>Reset your password</mjml>',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SHARED_HTML,
		tenantId: null,
		organizationId: null,
		name: 'password/html',
		languageCode: LanguagesEnum.ENGLISH,
		title: 'password',
		hbs: '<html>Reset your password (default)</html>',
		mjml: '<mjml>Reset your password (default)</mjml>',
		createdAt: new Date('2026-03-02T10:00:00.000Z'),
		updatedAt: new Date('2026-03-02T10:00:00.000Z')
	},
	{
		id: ORG_HTML_GERMAN,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'password/html',
		languageCode: LanguagesEnum.GERMAN,
		title: 'password',
		hbs: '<html>Passwort zurücksetzen</html>',
		mjml: '<mjml>Passwort zurücksetzen</mjml>',
		createdAt: new Date('2026-03-03T10:00:00.000Z'),
		updatedAt: new Date('2026-03-03T10:00:00.000Z')
	},
	{
		id: ORG_SUBJECT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'password/subject',
		languageCode: LanguagesEnum.ENGLISH,
		title: 'password',
		hbs: 'Reset your password',
		mjml: null,
		createdAt: new Date('2026-03-04T10:00:00.000Z'),
		updatedAt: new Date('2026-03-04T10:00:00.000Z')
	},
	{
		id: TENANT_WIDE_HTML,
		tenantId: TENANT,
		organizationId: null,
		name: 'welcome-user/html',
		languageCode: LanguagesEnum.ENGLISH,
		title: 'welcome user',
		hbs: '<html>Welcome</html>',
		mjml: null,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	}
];

/** What the delivered lookup answers with, so the fallback's answer can be asserted as it stands. */
const RESOLVED_CONTENT = {
	subject: 'Reset your password',
	template: '<mjml>Reset your password (default)</mjml>'
};

/** The resolver, over a scripted service and the two scripted buses. */
function surfaces() {
	const emailTemplateService = {
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const queryBus = {
		execute: jest.fn().mockImplementation(async (query: unknown) => {
			if (query instanceof EmailTemplateQuery) {
				return { items: ROWS, total: ROWS.length };
			}
			if (query instanceof FindEmailTemplateQuery) {
				return RESOLVED_CONTENT;
			}
			if (query instanceof EmailTemplateGeneratePreviewQuery) {
				return { html: '<html>Reset your password</html>' };
			}

			return undefined;
		})
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[3]) };

	return {
		emailTemplateService,
		queryBus,
		commandBus,
		resolver: new EmailTemplateResolver(
			emailTemplateService as never,
			queryBus as never,
			commandBus as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('emailtemplate'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmailTemplateController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmailTemplateController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmailTemplateController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = EmailTemplateResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('EmailTemplateResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the two delivered reads', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'emailTemplates',
				'emailTemplate',
				'emailTemplateCount',
				'emailTemplateContent',
				'emailTemplatePreview'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmailTemplate',
				'updateEmailTemplate',
				'deleteEmailTemplate',
				'softDeleteEmailTemplate',
				'recoverEmailTemplate',
				'saveEmailTemplate'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two do NOT answer
		// the same rows: `GET /` reads the caller's copies and the organization-less ones beside them,
		// while `/pagination` binds the query string to the store and answers the caller's copies alone.
		// One capability is one root field, and the field mirrors the wider read; a second root field for
		// the paginated spelling would be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'emailTemplate',
			'emailTemplateContent',
			'emailTemplateCount',
			'emailTemplatePreview',
			'emailTemplates'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmailTemplate',
			'deleteEmailTemplate',
			'recoverEmailTemplate',
			'saveEmailTemplate',
			'softDeleteEmailTemplate',
			'updateEmailTemplate'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmailTemplateConnection \{\s*nodes: \[EmailTemplate!\]!\s*edges: \[EmailTemplateEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmailTemplateEdge \{\s*node: EmailTemplate!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmailTemplateFilter \{/);
		expect(printed).toMatch(/input EmailTemplateSort \{/);
		expect(printed).toMatch(
			/enum EmailTemplateSortField \{\s*createdAt\s*updatedAt\s*name\s*languageCode\s*\}/
		);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateEmailTemplateInput \{/);
		expect(printed).toMatch(/input UpdateEmailTemplateInput \{/);
		expect(printed).toMatch(/input SaveEmailTemplateInput \{/);
	});

	it('carries the two body columns as the text they are, and not as a document', () => {
		const body = typeBody('EmailTemplate');

		// `hbs` is the compiled part and `mjml` the source it was compiled from: both are text columns, so
		// both are `String`. A `JSON` here would tell a client to parse a string of markup.
		expect(body).toMatch(/\bhbs: String!/);
		expect(body).toMatch(/\bmjml: String\b/);
		expect(body).not.toContain('JSON');
		// The address and the language are the pair the delivered reader resolves a message with, and the
		// name column is not nullable: a part with no address is a part nothing can look up.
		expect(body).toMatch(/\bname: String!/);
		expect(body).toMatch(/\blanguageCode: String!/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a copy would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers the tenant-wide copy as a filterable member rather than leaving it unstateable', () => {
		const filter = inputBody('EmailTemplateFilter');

		// A row with no organization is the copy the platform answers to every organization of its tenant;
		// an `IDFilter` is what lets a caller state it, because `isNull` is a condition of its own.
		expect(filter).toMatch(/organizationId: IDFilter/);
		expect(filter).toMatch(/tenantId: IDFilter/);
		expect(filter).toMatch(/name: StringFilter/);
		expect(filter).toMatch(/languageCode: StringFilter/);
		// The delivered list read answers live rows only, so a condition on this column could only ever be
		// one no row matches.
		expect(filter).not.toContain('deletedAt');
	});

	it('offers no argument it cannot honour', () => {
		// The delivered count route's query string is the store's own `where`, a shape no schema can state,
		// so the count states no filter rather than one the resolver could not pass on.
		expect(printed).not.toMatch(/emailTemplateCount\(/);
		// A nullable `Int` rather than a non-null one: a fabricated zero and "not answered" are two facts.
		expect(printed).toMatch(/emailTemplateCount: Int\b/);
		expect(printed).not.toMatch(/emailTemplateCount: Int!/);
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/emailTemplates\([^)]*withDeleted/);
	});
});

describe('EmailTemplateResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, queryBus } = surfaces();

		const connection = await resolver.emailTemplates(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, through the same query, with the tenant
		// predicate a well-formed REST request states. No request is in flight in this suite, so the
		// context answers no tenant and the criterion carries none — which is the point being asserted,
		// that the tenant comes from the context rather than from an argument a caller could choose.
		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(EmailTemplateQuery);
		expect(query.options).toEqual({ where: { tenantId: null } });

		expect(connection.nodes).toHaveLength(ROWS.length);
		expect(connection.totalCount).toBe(ROWS.length);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[ROWS.length - 1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ORG_HTML_GERMAN);
	});

	it('orders by the address of the part when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.emailTemplates();

		// The name the part is looked up by, then the language, then the identifier that makes the order
		// total: an ascending walk of exactly the addresses this table holds, in the address's own order.
		expect(connection.nodes.map((node) => node.id)).toEqual([
			ORG_HTML_GERMAN,
			ORG_HTML,
			SHARED_HTML,
			ORG_SUBJECT,
			TENANT_WIDE_HTML
		]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.emailTemplates({ name: { eq: 'password/html' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([ORG_HTML_GERMAN, ORG_HTML, SHARED_HTML]);

		const byLanguage = await resolver.emailTemplates({ languageCode: { eq: LanguagesEnum.GERMAN } });
		expect(byLanguage.nodes.map((node) => node.id)).toEqual([ORG_HTML_GERMAN]);

		const byPart = await resolver.emailTemplates({ name: { eq: 'password/subject' } });
		expect(byPart.nodes.map((node) => node.id)).toEqual([ORG_SUBJECT]);

		const byTenant = await resolver.emailTemplates({ tenantId: { eq: TENANT } });
		expect(byTenant.nodes.map((node) => node.id)).toEqual([
			ORG_HTML_GERMAN,
			ORG_HTML,
			ORG_SUBJECT,
			TENANT_WIDE_HTML
		]);
		// An `eq` never matches an absent column: the copy seeded platform-wide belongs to no tenant to
		// compare against, so it is the one row a tenant-scoped condition cannot select.
		expect(byTenant.nodes.map((node) => node.id)).not.toContain(SHARED_HTML);
	});

	it('narrows to the tenant-wide copies, which is the row the whole tenant falls back to', async () => {
		const { resolver } = surfaces();

		const tenantWide = await resolver.emailTemplates({ organizationId: { isNull: true } });

		// Two rows carry no organization, and both are copies the platform answers to organizations that
		// hold none of their own: the one seeded platform-wide and the one this tenant filed for itself.
		expect(tenantWide.nodes.map((node) => node.id)).toEqual([SHARED_HTML, TENANT_WIDE_HTML]);

		const byOrganization = await resolver.emailTemplates({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.nodes.map((node) => node.id)).toEqual([
			ORG_HTML_GERMAN,
			ORG_HTML,
			ORG_SUBJECT
		]);
	});

	it('separates the platform-wide copy from a tenant’s own organization-less copy', async () => {
		const { resolver } = surfaces();

		// The seeded copies carry no tenant either, so the two keys together state which of the two
		// organization-less rows a caller means — a distinction the object type reports and the filter has
		// to be able to select on.
		const seeded = await resolver.emailTemplates({ tenantId: { isNull: true } });
		expect(seeded.nodes.map((node) => node.id)).toEqual([SHARED_HTML]);

		const filedByTheTenant = await resolver.emailTemplates({
			tenantId: { eq: TENANT },
			organizationId: { isNull: true }
		});
		expect(filedByTheTenant.nodes.map((node) => node.id)).toEqual([TENANT_WIDE_HTML]);

		// The reader answered the seeded copy and the tenant's copies; the filter narrowed that set rather
		// than reaching outside it.
		expect(seeded.nodes[0].tenantId).toBeNull();
		expect(filedByTheTenant.nodes[0].tenantId).toBe(TENANT);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byLanguage = await resolver.emailTemplates(undefined, [
			{ field: 'languageCode', direction: 'ASC' }
		]);
		expect(byLanguage.nodes.map((node) => node.id)).toEqual([
			ORG_HTML_GERMAN,
			ORG_HTML,
			SHARED_HTML,
			ORG_SUBJECT,
			TENANT_WIDE_HTML
		]);

		const newestFirst = await resolver.emailTemplates(undefined, [
			{ field: 'createdAt', direction: 'DESC' }
		]);
		expect(newestFirst.nodes.map((node) => node.id)).toEqual([
			TENANT_WIDE_HTML,
			ORG_SUBJECT,
			ORG_HTML_GERMAN,
			SHARED_HTML,
			ORG_HTML
		]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.emailTemplates(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ORG_HTML_GERMAN]);

		const second = await resolver.emailTemplates(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ORG_HTML]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.emailTemplates(undefined, undefined, undefined, 20);

		const last = await resolver.emailTemplates(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([ORG_HTML_GERMAN]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.emailTemplates(undefined, [{ field: 'organizationId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.emailTemplates({ deletedAt: { isNull: true } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.emailTemplates(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmailTemplateResolver — one concept, two protocols, the same operations', () => {
	it('reads one template through the same call the REST node route makes', async () => {
		const { resolver, emailTemplateService } = surfaces();

		expect(await resolver.emailTemplate(ORG_HTML)).toBe(ROWS[0]);
		expect(emailTemplateService.findOneByIdString).toHaveBeenCalledWith(ORG_HTML, {
			where: { tenantId: null }
		});
	});

	it('answers null for a template that is not there, which is the REST route’s refusal in this vocabulary', async () => {
		const { resolver, emailTemplateService } = surfaces();
		emailTemplateService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.emailTemplate(SHARED_HTML)).toBeNull();
	});

	it('counts through the same call the count route makes, with the route’s own criterion', async () => {
		const { resolver, emailTemplateService } = surfaces();

		expect(await resolver.emailTemplateCount()).toBe(ROWS.length);
		// The scope is the credential's and never the caller's: the route reads the tenant from the
		// request context, and so does the field.
		expect(emailTemplateService.countBy).toHaveBeenCalledWith({ tenantId: null });
	});

	it('resolves a message’s content through the query the REST lookup route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		const content = await resolver.emailTemplateContent(
			'password',
			LanguagesEnum.GERMAN,
			ORGANIZATION
		);

		expect(content).toEqual(RESOLVED_CONTENT);

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(FindEmailTemplateQuery);
		// The organization is stated, the tenant is not: the delivered handler reads the tenant from the
		// credential, which is what keeps the fallback inside the caller's own tenant.
		expect(query.input).toEqual({
			name: 'password',
			languageCode: LanguagesEnum.GERMAN,
			organizationId: ORGANIZATION
		});
		// The language beside it is the request's own, which is what the delivered language header answers.
		expect(query.themeLanguage).toBe(LanguagesEnum.ENGLISH);
	});

	it('converts a document through the query the REST preview route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		expect(await resolver.emailTemplatePreview('<mjml>Reset</mjml>')).toEqual({
			html: '<html>Reset your password</html>'
		});

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(EmailTemplateGeneratePreviewQuery);
		expect(query.input).toBe('<mjml>Reset</mjml>');
	});

	it('files a template through the same service method the REST create route calls', async () => {
		const { resolver, emailTemplateService } = surfaces();

		expect(
			await resolver.createEmailTemplate({
				name: 'password/html',
				languageCode: LanguagesEnum.ENGLISH,
				hbs: '<html>Reset</html>',
				mjml: '<mjml>Reset</mjml>',
				organizationId: ORGANIZATION
			})
		).toBe(ROWS[0]);

		// The tenant is stamped from the credential and is never a member of the input, which is what keeps
		// a caller out of another tenant's rows; the organization is a member, because it is a column the
		// caller states.
		expect(emailTemplateService.create).toHaveBeenCalledWith({
			name: 'password/html',
			languageCode: LanguagesEnum.ENGLISH,
			hbs: '<html>Reset</html>',
			mjml: '<mjml>Reset</mjml>',
			organizationId: ORGANIZATION,
			tenantId: null
		});
	});

	it('files the tenant-wide copy when the caller states no organization', async () => {
		const { resolver, emailTemplateService } = surfaces();

		await resolver.createEmailTemplate({
			name: 'welcome-user/html',
			languageCode: LanguagesEnum.ENGLISH,
			hbs: '<html>Welcome</html>'
		});

		// An absent organization is a statement rather than an omission: the row belongs to no
		// organization, and the platform answers it to every organization of the tenant.
		expect(emailTemplateService.create.mock.calls[0][0].organizationId).toBeUndefined();
	});

	it('replaces a template through the same service method the REST edit route calls, in the route’s order', async () => {
		const { resolver, emailTemplateService } = surfaces();

		await resolver.updateEmailTemplate({
			id: ORG_HTML,
			name: 'password/html',
			mjml: '<mjml>Reset again</mjml>'
		});

		// The delivered route reads the row before it writes it, and so does the field: a caller naming a
		// copy of another tenant is answered with the miss rather than with a write matching nothing.
		expect(emailTemplateService.findOneByIdString).toHaveBeenCalledWith(ORG_HTML, {
			where: { tenantId: null }
		});
		expect(emailTemplateService.update).toHaveBeenCalledWith(
			{ id: ORG_HTML, tenantId: null },
			{ name: 'password/html', mjml: '<mjml>Reset again</mjml>' }
		);
		// The answer is the row the write produced, read back through the same service, rather than the
		// store's update result — a statement about the write is not a row.
		expect(emailTemplateService.findOneByIdString).toHaveBeenCalledTimes(2);
	});

	it('leaves a member the edit does not state out of the payload rather than writing it as absent', async () => {
		const { resolver, emailTemplateService } = surfaces();

		await resolver.updateEmailTemplate({ id: ORG_HTML, name: 'password/html' });

		const payload = emailTemplateService.update.mock.calls[0][1];
		expect(payload).toEqual({ name: 'password/html' });
		// A member left out is left as it is, which is what the delivered partial column update does.
		expect('mjml' in payload).toBe(false);
		expect('organizationId' in payload).toBe(false);

		// A member stated as null is written as null, which is a different request: it moves the copy to
		// the tenant-wide one every organization of the tenant falls back to.
		await resolver.updateEmailTemplate({ id: ORG_HTML, organizationId: null });
		expect(emailTemplateService.update.mock.calls[1][1]).toEqual({ organizationId: null });
	});

	it('removes a template through the same calls the REST delete route makes, in the route’s order', async () => {
		const { resolver, emailTemplateService } = surfaces();

		expect(await resolver.deleteEmailTemplate(ORG_HTML)).toBe(true);
		expect(emailTemplateService.findOneByIdString).toHaveBeenCalledWith(ORG_HTML, {
			where: { tenantId: null }
		});
		expect(emailTemplateService.delete).toHaveBeenCalledWith({ id: ORG_HTML, tenantId: null });
	});

	it('withdraws and restores a template through the same service methods the REST routes call', async () => {
		const { resolver, emailTemplateService } = surfaces();

		const withdrawn = await resolver.softDeleteEmailTemplate(ORG_HTML);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(emailTemplateService.softRemove).toHaveBeenCalledWith(ORG_HTML);

		expect(await resolver.recoverEmailTemplate(ORG_HTML)).toBe(ROWS[0]);
		expect(emailTemplateService.softRecover).toHaveBeenCalledWith(ORG_HTML);
	});

	it('saves both parts of a message through the command the REST save route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.saveEmailTemplate({
			name: 'password',
			languageCode: LanguagesEnum.ENGLISH,
			mjml: '<mjml>Reset</mjml>',
			subject: 'Reset your password',
			organizationId: ORGANIZATION
		});

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmailTemplateSaveCommand);
		// The handler compiles the body from the source and stamps the tenant, so neither appears here:
		// what a caller states is the source, the subject and the organization.
		expect(command.input).toEqual({
			name: 'password',
			languageCode: LanguagesEnum.ENGLISH,
			mjml: '<mjml>Reset</mjml>',
			subject: 'Reset your password',
			organizationId: ORGANIZATION
		});
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, emailTemplateService } = surfaces();
		const refusal = new Error('EMAIL_TEMPLATE_LOCKED: this copy is owned by the platform.');

		emailTemplateService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEmailTemplate(ORG_HTML)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'emailTemplates', route: 'findAll' },
	{ field: 'emailTemplate', route: 'findById' },
	{ field: 'emailTemplateCount', route: 'getCount' },
	{ field: 'emailTemplateContent', route: 'findEmailTemplate' },
	{ field: 'emailTemplatePreview', route: 'generatePreview' },
	{ field: 'createEmailTemplate', route: 'create' },
	{ field: 'updateEmailTemplate', route: 'update' },
	{ field: 'deleteEmailTemplate', route: 'delete' },
	{ field: 'softDeleteEmailTemplate', route: 'softRemove' },
	{ field: 'recoverEmailTemplate', route: 'softRecover' },
	{ field: 'saveEmailTemplate', route: 'saveEmailTemplate' }
];

describe('EmailTemplateResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EmailTemplateResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EmailTemplateController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmailTemplateResolver) ?? [];
		const routes = [
			'findAll',
			'pagination',
			'findById',
			'getCount',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover',
			'findEmailTemplate',
			'generatePreview',
			'saveEmailTemplate'
		];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow REST
			// below GraphQL and is caught here.
			expect([...guardsOfRoute(EmailTemplateController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmailTemplateResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmailTemplateController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmailTemplateController)).toEqual([
			PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(PERMISSION_PARITY.map(({ field }) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			PERMISSION_PARITY.map(({ field, route }) => [
				field,
				permissionOfRoute(EmailTemplateController, route)
			])
		);

		expect(stated).toEqual(expected);
	});

	it('states the same permission on both spellings of the list, because they are one capability', () => {
		// The controller serves `GET /` and `GET /pagination`; the connection is the one root field for
		// both, and it may not be narrower than either of them.
		expect(permissionOfField('emailTemplates')).toEqual(
			permissionOfRoute(EmailTemplateController, 'findAll')
		);
		expect(permissionOfField('emailTemplates')).toEqual(
			permissionOfRoute(EmailTemplateController, 'pagination')
		);
	});

	it('carries the class permission on the lifecycle fields, because their routes do', () => {
		// The create, the soft removal and the recovery are inherited from the CRUD base, where no handler
		// states a permission of its own — so the controller's class-level one is the one they run under,
		// and the fields state the same rather than none. A field that demanded nothing would be wider than
		// the route it mirrors.
		for (const handler of ['create', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmailTemplateController)[handler])).toBeUndefined();
			expect(permissionOfRoute(EmailTemplateController, handler)).toEqual([
				PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES
			]);
		}

		for (const field of ['createEmailTemplate', 'softDeleteEmailTemplate', 'recoverEmailTemplate']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES]);
		}
	});
});

describe('EmailTemplateModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmailTemplateModule) ?? []) as unknown[];

		expect(providers).toContain(EmailTemplateResolver);
		expect(providers).toContain(EmailTemplateService);
	});

	it('exports the service and the buses the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmailTemplateModule) ?? []) as unknown[];

		expect(exported).toContain(EmailTemplateService);
		expect(exported).toContain(CqrsModule);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (EmailTemplateResolver.prototype as never)[field],
		getClass: () => EmailTemplateResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmailTemplateResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmailTemplateResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmailTemplateResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('emailTemplates')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('emailTemplates');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('emailTemplates'))).resolves.toBe(true);
	});
});
