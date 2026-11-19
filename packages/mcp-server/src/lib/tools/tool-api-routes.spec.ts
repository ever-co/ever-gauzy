/**
 * Every API call of the tools reaches a route the API serves. A path no controller declares answers 404, and a fixed
 * word where the route expects a value (`/employee/me` on `/employee/:id`) is read as that value and refused, so the
 * tool fails on every call, or reports a change that never happened (#12092).
 *
 * It parses the sources rather than importing the controllers: importing ~400 controller modules pulls in the whole
 * entity graph. A route a controller inherits counts, `CrudController`'s nine included.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const CONTROLLER_ROOTS = ['packages/core/src', 'packages/plugins'];
const ROUTE_DECORATORS: Record<string, string> = {
	Get: 'GET',
	Post: 'POST',
	Put: 'PUT',
	Patch: 'PATCH',
	Delete: 'DELETE'
};
/** `CrudFactory(...)` returns a class with the routes of `CrudController`. */
const CLASS_FACTORIES: Record<string, string> = { CrudFactory: 'CrudController' };
const API_CLIENT_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
/** Helpers of the tools that read a list route: their first argument is a GET path. */
const GET_HELPERS = new Set(['readAllPages']);
/** A path handed to another helper of the tools, whose method the scan cannot tell: a route of any method serves it. */
const ANY_METHOD = '*';
/** A call segment built from a value: it fills a `:param` of the route. */
const VALUE = '${}';

interface Route {
	method: string;
	segments: string[];
}

interface ApiCall {
	method: string;
	segments: string[];
	/** `<method> <path> (<file>:<line>)`, for a failure that names the call. */
	label: string;
}

interface ControllerClass {
	prefixes: string[];
	routes: Route[];
	base?: string;
}

const segmentsOf = (routePath: string) => routePath.split('?')[0].split('/').filter(Boolean);
const isParam = (segment: string) => segment.startsWith(':');

function filesUnder(directory: string, keep: (name: string) => boolean): string[] {
	const files: string[] = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const skipped = entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.');
		if (skipped) {
			continue;
		}
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...filesUnder(full, keep));
		} else if (keep(entry.name)) {
			files.push(full);
		}
	}
	return files.sort();
}

function parse(file: string): ts.SourceFile {
	return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function decoratorsOf(node: ts.Node): readonly ts.Decorator[] {
	if (!ts.canHaveDecorators(node)) {
		return [];
	}
	return ts.getDecorators(node) ?? [];
}

function decoratorName(decorator: ts.Decorator): string | undefined {
	const call = decorator.expression;
	if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
		return undefined;
	}
	return call.expression.text;
}

/** The initializer of the `const` of this name in the same file, looked up scope by scope from the node. */
function constantNamed(name: string, from: ts.Node): ts.Expression | undefined {
	for (let scope: ts.Node | undefined = from; scope; scope = scope.parent) {
		const statements = (scope as { statements?: ts.NodeArray<ts.Statement> }).statements ?? [];
		for (const statement of statements.filter(ts.isVariableStatement)) {
			const declaration = statement.declarationList.declarations.find(
				(candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === name
			);
			if (declaration?.initializer) {
				return declaration.initializer;
			}
		}
	}
	return undefined;
}

/** The relative module a statement imports this name from, when it does. */
function relativeImportOf(name: string, statement: ts.Statement): string | undefined {
	if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
		return undefined;
	}
	const bindings = statement.importClause?.namedBindings;
	if (!bindings || !ts.isNamedImports(bindings)) {
		return undefined;
	}
	const importsName = bindings.elements.some((element) => element.name.text === name);
	const isRelative = statement.moduleSpecifier.text.startsWith('.');
	if (!importsName || !isRelative) {
		return undefined;
	}
	return statement.moduleSpecifier.text;
}

/** The initializer of a constant the file imports from a module of its package, as route prefixes are. */
function importedConstant(name: string, source: ts.SourceFile): ts.Expression | undefined {
	for (const statement of source.statements) {
		const module = relativeImportOf(name, statement);
		if (!module) {
			continue;
		}
		const base = path.resolve(path.dirname(source.fileName), module);
		const file = [`${base}.ts`, path.join(base, 'index.ts')].find((candidate) => fs.existsSync(candidate));
		if (file) {
			return constantNamed(name, parse(file));
		}
	}
	return undefined;
}

/** The text a template span stands for: the constant it names, else a value. */
function spanText(expression: ts.Expression, source: ts.SourceFile): string {
	if (!ts.isIdentifier(expression)) {
		return VALUE;
	}
	const [constant] = pathsOf(expression, source);
	return constant ?? VALUE;
}

/**
 * The paths an expression spells, a value standing as `${}`: a literal, a template, a constant, either branch of a
 * condition. An expression the scan cannot follow (a parameter) spells none.
 */
function pathsOf(expression: ts.Expression, source: ts.SourceFile): string[] {
	if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
		return [expression.text];
	}
	if (ts.isParenthesizedExpression(expression)) {
		return pathsOf(expression.expression, source);
	}
	if (ts.isConditionalExpression(expression)) {
		return [...pathsOf(expression.whenTrue, source), ...pathsOf(expression.whenFalse, source)];
	}
	if (ts.isIdentifier(expression)) {
		const value = constantNamed(expression.text, expression) ?? importedConstant(expression.text, source);
		if (!value) {
			return [];
		}
		return pathsOf(value, source);
	}
	if (ts.isTemplateExpression(expression)) {
		const spelled = expression.templateSpans.reduce(
			(text, span) => `${text}${spanText(span.expression, source)}${span.literal.text}`,
			expression.head.text
		);
		return [spelled];
	}
	return [];
}

/** The paths a route decorator states: none stated is the controller's own path. */
function routeArguments(decorator: ts.Decorator, source: ts.SourceFile): string[] {
	const call = decorator.expression as ts.CallExpression;
	const [argument] = call.arguments;
	if (!argument) {
		return [''];
	}
	if (ts.isArrayLiteralExpression(argument)) {
		return argument.elements.flatMap((element) => pathsOf(element, source));
	}
	return pathsOf(argument, source);
}

/** The name of the class a class extends. */
function baseOf(node: ts.ClassDeclaration): string | undefined {
	const clause = node.heritageClauses?.find((heritage) => heritage.token === ts.SyntaxKind.ExtendsKeyword);
	const expression = clause?.types[0].expression;
	if (!expression) {
		return undefined;
	}
	if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
		const factory = expression.expression.text;
		return CLASS_FACTORIES[factory] ?? factory;
	}
	if (ts.isIdentifier(expression)) {
		return expression.text;
	}
	return undefined;
}

function routesOf(member: ts.ClassElement, source: ts.SourceFile): Route[] {
	return decoratorsOf(member).flatMap((decorator) => {
		const method = ROUTE_DECORATORS[decoratorName(decorator) ?? ''];
		if (!method) {
			return [];
		}
		return routeArguments(decorator, source).map((routePath) => ({ method, segments: segmentsOf(routePath) }));
	});
}

function controllerClass(node: ts.ClassDeclaration, source: ts.SourceFile): ControllerClass {
	const controller = decoratorsOf(node).find((decorator) => decoratorName(decorator) === 'Controller');
	const routes = node.members.flatMap((member) => routesOf(member, source));
	let prefixes: string[] = [];
	if (controller) {
		prefixes = routeArguments(controller, source);
	}
	return { prefixes, routes, base: baseOf(node) };
}

/** Every route of the controllers of the core and the plugins, the ones a controller inherits included. */
function servedRoutes(): Route[] {
	const classes = new Map<string, ControllerClass[]>();
	const controllers: ControllerClass[] = [];
	const files = CONTROLLER_ROOTS.flatMap((root) =>
		filesUnder(path.join(REPO_ROOT, root), (name) => name.endsWith('.controller.ts'))
	);
	for (const file of files) {
		const source = parse(file);
		for (const statement of source.statements.filter(ts.isClassDeclaration)) {
			const declared = controllerClass(statement, source);
			const name = statement.name?.text ?? '';
			classes.set(name, [...(classes.get(name) ?? []), declared]);
			if (declared.prefixes.length > 0) {
				controllers.push(declared);
			}
		}
	}

	const withInherited = (declared: ControllerClass, seen: Set<ControllerClass>): Route[] => {
		seen.add(declared);
		const bases = (classes.get(declared.base ?? '') ?? []).filter((base) => !seen.has(base));
		return [...declared.routes, ...bases.flatMap((base) => withInherited(base, seen))];
	};
	return controllers.flatMap((controller) => {
		const routes = withInherited(controller, new Set());
		return controller.prefixes.flatMap((prefix) =>
			routes.map(({ method, segments }) => ({ method, segments: [...segmentsOf(prefix), ...segments] }))
		);
	});
}

/** The method and the path argument of an API call: `apiClient.<method>(path)`, or a helper handed a path. */
function callOf(node: ts.CallExpression): { method: string; target: ts.Expression } | undefined {
	const [target] = node.arguments;
	const callee = node.expression;
	if (!target) {
		return undefined;
	}
	if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
		const onApiClient = callee.expression.text === 'apiClient';
		const method = callee.name.text;
		if (onApiClient && API_CLIENT_METHODS.has(method)) {
			return { method: method.toUpperCase(), target };
		}
	}
	if (!ts.isIdentifier(callee)) {
		return undefined;
	}
	if (GET_HELPERS.has(callee.text)) {
		return { method: 'GET', target };
	}
	return { method: ANY_METHOD, target };
}

/** The segments of an API path after `/api`, a segment built from a value standing as `${}`; none for another path. */
function apiSegmentsOf(callPath: string): string[] | undefined {
	const [prefix, ...segments] = segmentsOf(callPath);
	if (prefix !== 'api') {
		return undefined;
	}
	return segments.map((segment) => {
		if (segment.includes(VALUE)) {
			return VALUE;
		}
		return segment;
	});
}

/** The API calls a call expression of a tool source makes, one per path it can spell. */
function callsAt(node: ts.CallExpression, source: ts.SourceFile): ApiCall[] {
	const call = callOf(node);
	if (!call) {
		return [];
	}
	const file = path.relative(REPO_ROOT, source.fileName).split(path.sep).join('/');
	const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
	return pathsOf(call.target, source).flatMap((callPath) => {
		const segments = apiSegmentsOf(callPath);
		if (!segments) {
			return [];
		}
		return [{ method: call.method, segments, label: `${call.method} ${callPath} (${file}:${line})` }];
	});
}

/** Every API call of the tool sources. */
function toolCalls(): ApiCall[] {
	const calls: ApiCall[] = [];
	for (const file of filesUnder(__dirname, (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))) {
		const source = parse(file);
		const visit = (node: ts.Node) => {
			if (ts.isCallExpression(node)) {
				calls.push(...callsAt(node, source));
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return calls;
}

/** The index of the first `:param` of the route a fixed word of the call fills, or -1. */
const wordInParamAt = (route: Route, call: ApiCall) =>
	route.segments.findIndex((segment, index) => isParam(segment) && call.segments[index] !== VALUE);

/** Whether the route has the call's method and shape: each fixed segment the same, each `:param` filled. */
function fits(route: Route, call: ApiCall): boolean {
	const sameMethod = call.method === ANY_METHOD || route.method === call.method;
	const sameLength = route.segments.length === call.segments.length;
	if (!sameMethod || !sameLength) {
		return false;
	}
	return route.segments.every((segment, index) => isParam(segment) || call.segments[index] === segment);
}

/** The calls no route serves, each with why. */
function unserved(calls: ApiCall[], routes: Route[]): string[] {
	return calls.flatMap((call) => {
		const fitting = routes.filter((route) => fits(route, call));
		if (fitting.some((route) => wordInParamAt(route, call) < 0)) {
			return [];
		}
		const [route] = fitting;
		if (!route) {
			return [`${call.label}: no route`];
		}
		const index = wordInParamAt(route, call);
		const routePath = `/${route.segments.join('/')}`;
		return [`${call.label}: \`${call.segments[index]}\` fills ${route.segments[index]} of ${routePath}`];
	});
}

describe('the API routes the tools call', () => {
	const routes = servedRoutes();
	const calls = toolCalls();

	it('scans the whole surface, not a handful of files', () => {
		expect(routes.length).toBeGreaterThan(3000);
		expect(calls.length).toBeGreaterThan(300);
	});

	it('finds the routes a controller inherits from CrudController', () => {
		const inherited = { method: 'DELETE', segments: ['merchants', VALUE, 'soft'], label: 'DELETE inherited' };

		expect(unserved([inherited], routes)).toEqual([]);
	});

	it('tells a fixed word in place of a value, and a path no controller declares', () => {
		const word = { method: 'GET', segments: ['employee', 'me'], label: 'GET /api/employee/me' };
		const missing = { method: 'POST', segments: ['employee', VALUE, 'restore'], label: 'POST restore' };

		expect(unserved([word, missing], routes)).toEqual([
			'GET /api/employee/me: `me` fills :id of /employee/:id',
			'POST restore: no route'
		]);
	});

	it('finds a route for every API call of the tools', () => {
		expect(unserved(calls, routes)).toEqual([]);
	});
});
