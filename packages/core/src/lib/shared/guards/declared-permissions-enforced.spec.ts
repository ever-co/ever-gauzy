import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * A `@Permissions(...)` that no guard checks against the caller's role.
 *
 * `@Permissions` only sets `PERMISSIONS_METADATA`. Two guards read it, and they ask different questions:
 *   - `TenantPermissionGuard` calls `checkRolePermission(tenantId, roleId, permissions)` WITHOUT
 *     `includeRole`, so it only asks whether ANY role of the tenant holds one of the permissions. In a
 *     tenant whose ADMIN holds `ORG_CANDIDATES_VIEW`, that is true for every caller — VIEWER included.
 *   - `PermissionGuard` passes `includeRole: true` and asks it of the caller's own role.
 *
 * So a route that states a permission behind `TenantPermissionGuard` alone READS as gated and is open to
 * every authenticated member of the tenant. `CandidateExperienceController` shipped exactly that as
 * `@UseGuards(TenantPermissionGuard, TenantPermissionGuard)`, and the ActivePieces and SIM integration
 * controllers did with `@UseGuards(TenantPermissionGuard)`: VIEWER could list candidate experience, and
 * any member could configure an integration's API key, rotate an MCP server token or execute a workflow.
 *
 * The repo-wide scan of `mutating-route-permissions.spec.ts` did not catch them: it counts a route as gated
 * when it states a permission, without asking whether anything reads it, and it only looks at mutating
 * routes. This suite asks the other half of the question, of EVERY root operation — REST route or GraphQL
 * query, mutation and subscription, declared or inherited from `CrudController` / `CrudFactory`: wherever
 * the effective permission metadata is non-empty, a guard that evaluates it against the caller must be in
 * the route's chain (the class's `@UseGuards` plus the handler's).
 *
 * `@ResolveField` handlers are left out on purpose: the GraphQL module sets no `fieldResolverEnhancers`, so
 * Nest runs no guard on them at all, and a permission a field states has to be checked in its body (R2-G10).
 *
 * It parses the sources rather than importing the controllers, for the reason the mutating-route scan
 * gives: importing ~400 controller and resolver modules pulls in the whole entity graph.
 */

/** Roots the scan walks: the same as the mutating-route scan's. */
const SCANNED_ROOTS = ['packages/core/src', 'packages/plugins'];

/**
 * The guards that evaluate `PERMISSIONS_METADATA` against the caller. `PermissionGuard` checks the role;
 * `OrganizationPermissionGuard` evaluates the stated permissions as the organization's time-tracking
 * policy, for every role. A guard that `extends` one of them (`ProjectManagerOrPermissionGuard`) counts
 * too, and is found by the scan rather than listed here.
 */
const PERMISSION_READING_GUARDS: ReadonlyArray<string> = Object.freeze([
	'PermissionGuard',
	'OrganizationPermissionGuard'
]);

/** The method decorators Nest runs the guard chain for: REST routes and GraphQL root operations. */
const ROUTE_DECORATORS = new Set([
	'Get',
	'Post',
	'Put',
	'Patch',
	'Delete',
	'All',
	'Head',
	'Options',
	'Sse',
	'Query',
	'Mutation',
	'Subscription'
]);

/** The nine routes `CrudController` and `CrudFactory` declare with no guard and no permission. */
const INHERITED_CRUD_ROUTES: ReadonlyArray<string> = Object.freeze([
	'getCount',
	'pagination',
	'findAll',
	'findById',
	'create',
	'update',
	'delete',
	'softRemove',
	'softRecover'
]);

interface ParsedSource {
	file: string;
	source: ts.SourceFile;
}

interface UnreadPermission {
	/** `<file>: <Class>.<method>`, for a failure message that names the route. */
	route: string;
	guards: string[];
}

/** Every `*.controller.ts` and `*.resolver.ts` under the scanned roots, parsed, in a stable order. */
function parseSources(repoRoot: string): ParsedSource[] {
	const files: string[] = [];

	const walk = (directory: string): void => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(directory, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
				continue;
			}
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (/\.(controller|resolver|guard)\.ts$/.test(entry.name)) {
				files.push(full);
			}
		}
	};

	for (const root of SCANNED_ROOTS) {
		walk(path.join(repoRoot, root));
	}

	return files.sort().map((file) => ({
		file: path.relative(repoRoot, file).split(path.sep).join('/'),
		source: ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
	}));
}

function decoratorsOf(node: ts.Node): readonly ts.Decorator[] {
	// `node.decorators` up to TypeScript 4.7, `ts.getDecorators()` from 5.0 on.
	return ((ts as any).getDecorators?.(node) ?? (node as any).decorators ?? []) as readonly ts.Decorator[];
}

function decoratorCalls(node: ts.Node, name: string): ts.CallExpression[] {
	const calls: ts.CallExpression[] = [];
	for (const decorator of decoratorsOf(node)) {
		const expression = decorator.expression;
		if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
			if (expression.expression.text === name) {
				calls.push(expression);
			}
		}
	}
	return calls;
}

/** The guards every `@UseGuards(...)` on this node lists, in order, as written. */
function guardsOf(node: ts.Node, source: ts.SourceFile): string[] {
	return decoratorCalls(node, 'UseGuards').flatMap((call) =>
		call.arguments.map((argument) => argument.getText(source).replace(/\s+/g, ''))
	);
}

/** `undefined` when the node states no `@Permissions`; otherwise how many permissions it states. */
function declaredPermissionCount(node: ts.Node): number | undefined {
	const [call] = decoratorCalls(node, 'Permissions');
	return call?.arguments.length;
}

function isRoute(node: ts.MethodDeclaration): boolean {
	return decoratorsOf(node).some((decorator) => {
		const expression = decorator.expression;
		return (
			ts.isCallExpression(expression) &&
			ts.isIdentifier(expression.expression) &&
			ROUTE_DECORATORS.has(expression.expression.text)
		);
	});
}

function isControllerOrResolver(node: ts.ClassDeclaration): boolean {
	return decoratorCalls(node, 'Controller').length > 0 || decoratorCalls(node, 'Resolver').length > 0;
}

function baseClassOf(node: ts.ClassDeclaration, source: ts.SourceFile): string {
	const clause = node.heritageClauses?.find((heritage) => heritage.token === ts.SyntaxKind.ExtendsKeyword);
	return clause ? clause.types[0].expression.getText(source) : '';
}

/** The permission-reading guards, plus every class of the scanned sources that extends one of them. */
function permissionReadingGuards(sources: ParsedSource[]): Set<string> {
	const readers = new Set(PERMISSION_READING_GUARDS);
	const bases = new Map<string, string>();

	for (const { source } of sources) {
		for (const statement of source.statements) {
			if (ts.isClassDeclaration(statement) && statement.name) {
				bases.set(statement.name.text, baseClassOf(statement, source));
			}
		}
	}

	let grew = true;
	while (grew) {
		grew = false;
		for (const [name, base] of bases) {
			if (!readers.has(name) && readers.has(base)) {
				readers.add(name);
				grew = true;
			}
		}
	}

	return readers;
}

/**
 * Every root operation whose effective permission metadata is non-empty while no guard of its chain
 * evaluates it. The effective metadata is the handler's, else the class's — `getAllAndOverride` over
 * `[handler, class]`, which is what every one of these guards resolves.
 */
function scanUnreadPermissions(sources: ParsedSource[], readers: Set<string>): UnreadPermission[] {
	const unread: UnreadPermission[] = [];

	for (const { file, source } of sources) {
		for (const statement of source.statements) {
			if (!ts.isClassDeclaration(statement) || !statement.name || !isControllerOrResolver(statement)) {
				continue;
			}

			const className = statement.name.text;
			const classGuards = guardsOf(statement, source);
			const classPermissions = declaredPermissionCount(statement);

			const check = (method: string, node?: ts.MethodDeclaration): void => {
				const permissions = (node ? declaredPermissionCount(node) : undefined) ?? classPermissions ?? 0;
				if (permissions === 0) {
					return;
				}
				const guards = [...classGuards, ...(node ? guardsOf(node, source) : [])];
				if (!guards.some((guard) => readers.has(guard))) {
					unread.push({ route: `${file}: ${className}.${method}`, guards });
				}
			};

			const declared = new Set<string>();
			for (const member of statement.members) {
				if (ts.isMethodDeclaration(member) && member.name) {
					const method = member.name.getText(source);
					declared.add(method);
					if (isRoute(member)) {
						check(method, member);
					}
				}
			}

			// An inherited CRUD route carries no metadata of its own, so it runs under the class's guards and
			// permissions. A subclass method of the same name replaces it (Nest resolves the handler on the most
			// derived prototype) and was checked above.
			if (/^(CrudController|CrudFactory)\b/.test(baseClassOf(statement, source))) {
				for (const method of INHERITED_CRUD_ROUTES) {
					if (!declared.has(method)) {
						check(method);
					}
				}
			}
		}
	}

	return unread;
}

/** Every `@UseGuards(...)` that lists the same guard twice: the slip that hid `PermissionGuard`. */
function scanDuplicateGuards(sources: ParsedSource[]): string[] {
	const duplicates: string[] = [];

	const visit = (node: ts.Node, file: string, source: ts.SourceFile): void => {
		for (const call of decoratorCalls(node, 'UseGuards')) {
			const guards = call.arguments.map((argument) => argument.getText(source).replace(/\s+/g, ''));
			if (new Set(guards).size !== guards.length) {
				const { line } = source.getLineAndCharacterOfPosition(call.getStart(source));
				duplicates.push(`${file}:${line + 1} @UseGuards(${guards.join(', ')})`);
			}
		}
		ts.forEachChild(node, (child) => visit(child, file, source));
	};

	for (const { file, source } of sources) {
		visit(source, file, source);
	}

	return duplicates;
}

describe('every declared permission is checked against the caller', () => {
	const repoRoot = path.resolve(__dirname, '../../../../../..');
	const sources = parseSources(repoRoot);
	const readers = permissionReadingGuards(sources);

	it('scans the whole surface, not a handful of files', () => {
		// Guards against the walk silently finding nothing (a moved root, a changed file suffix).
		expect(sources.filter(({ file }) => /\.(controller|resolver)\.ts$/.test(file)).length).toBeGreaterThan(350);
	});

	it('recognises the guards that extend a permission-reading guard', () => {
		expect(readers.has('ProjectManagerOrPermissionGuard')).toBe(true);
		expect(readers.has('TenantPermissionGuard')).toBe(false);
	});

	it('puts a permission-reading guard in the chain of every route that states a permission', () => {
		expect(scanUnreadPermissions(sources, readers)).toEqual([]);
	});

	it('lists no guard twice in one @UseGuards(...)', () => {
		expect(scanDuplicateGuards(sources)).toEqual([]);
	});

	it('flags the shapes that shipped, and passes the ones that fixed them', () => {
		// Parsed in memory: these shapes must not exist in the tree, which is exactly the point.
		const parse = (text: string): ParsedSource[] => [
			{
				file: 'in-memory.controller.ts',
				source: ts.createSourceFile('in-memory.controller.ts', text, ts.ScriptTarget.Latest, true)
			}
		];

		const duplicated = parse(`
			@UseGuards(TenantPermissionGuard, TenantPermissionGuard)
			@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
			@Controller('/candidate-experience')
			class CandidateExperienceController extends CrudController<CandidateExperience> {
				@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
				@Get()
				findAll() {}
			}
		`);
		expect(scanUnreadPermissions(duplicated, readers).map(({ route }) => route)).toEqual([
			'in-memory.controller.ts: CandidateExperienceController.findAll',
			...INHERITED_CRUD_ROUTES.filter((method) => method !== 'findAll').map(
				(method) => `in-memory.controller.ts: CandidateExperienceController.${method}`
			)
		]);
		expect(scanDuplicateGuards(duplicated)).toEqual([
			'in-memory.controller.ts:2 @UseGuards(TenantPermissionGuard, TenantPermissionGuard)'
		]);

		const tenantOnly = parse(`
			@UseGuards(TenantPermissionGuard)
			@Controller('/integration/sim')
			class SimController {
				@Permissions(PermissionsEnum.INTEGRATION_ADD)
				@Post('/setup')
				setupIntegration() {}

				@Get('/events/supported')
				getSupportedEvents() {}
			}
		`);
		expect(scanUnreadPermissions(tenantOnly, readers).map(({ route }) => route)).toEqual([
			'in-memory.controller.ts: SimController.setupIntegration'
		]);

		const fixed = parse(`
			@UseGuards(TenantPermissionGuard, PermissionGuard)
			@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
			@Controller('/candidate-experience')
			class CandidateExperienceController extends CrudController<CandidateExperience> {}

			@Resolver('TimeLog')
			class TimeLogResolver {
				@UseGuards(OrganizationPermissionGuard)
				@Permissions(PermissionsEnum.ALLOW_MANUAL_TIME)
				@Mutation('addManualTimeLog')
				addManualTime() {}
			}
		`);
		expect(scanUnreadPermissions(fixed, readers)).toEqual([]);
		expect(scanDuplicateGuards(fixed)).toEqual([]);
	});
});
