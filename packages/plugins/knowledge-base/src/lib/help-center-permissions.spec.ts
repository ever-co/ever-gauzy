/**
 * GHSA-v79w-54p2-wmh5 — `PermissionGuard.canActivate()` returns `true` when a route carries no
 * `PERMISSIONS_METADATA`, so every mutating Help Center route that forgot `@Permissions(...)` was
 * reachable by any authenticated member of the tenant (EMPLOYEE, VIEWER, CANDIDATE included).
 *
 * Two families of route were affected:
 *   - the handlers declared in these controllers: PUT ':id', PATCH ':id/description',
 *     PUT ':id/binary-description', DELETE 'base/:baseId', DELETE 'article/:articleId',
 *     POST 'createBulk';
 *   - the handlers INHERITED from `CrudController` — POST '', PUT ':id', DELETE ':id',
 *     DELETE ':id/soft', PUT ':id/recover' — which Nest's MetadataScanner picks up off the
 *     prototype chain and which no subclass had overridden.
 *
 * `@gauzy/core` is a barrel over the whole server core; importing it for real pulls the ORM
 * bootstrap and every entity into the test runtime (and this package's jest config has no ESM
 * transform exceptions). The double below therefore stands in for it, but it declares the SAME five
 * inherited mutating routes as the real `packages/core/src/lib/core/crud/crud.controller.ts` and
 * uses the REAL `PERMISSIONS_METADATA` key, so the prototype-chain scan is meaningful. That the
 * real base class still declares exactly those five routes, un-guarded, is asserted separately in
 * `packages/core/src/lib/shared/guards/mutating-route-permissions.spec.ts`.
 */
jest.mock('@gauzy/core', () => {
	const common = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	class CrudController {
		constructor(_crudService: any) {
			/* the real base keeps a service reference; nothing here needs it */
		}
		async getCount(): Promise<any> {
			return 0;
		}
		async pagination(): Promise<any> {
			return null;
		}
		async findAll(): Promise<any> {
			return null;
		}
		async findById(): Promise<any> {
			return null;
		}
		async create(entity: any): Promise<any> {
			return entity;
		}
		async update(_id: any, entity: any): Promise<any> {
			return entity;
		}
		async delete(_id: any): Promise<any> {
			return null;
		}
		async softRemove(_id: any, ..._options: any[]): Promise<any> {
			return null;
		}
		async softRecover(_id: any, ..._options: any[]): Promise<any> {
			return null;
		}
	}

	// Applies route decorators the way TypeScript would, so the stub carries real Nest metadata.
	const route = (name: string, decorators: any[]) => {
		const descriptor = Object.getOwnPropertyDescriptor(CrudController.prototype, name);
		decorators.forEach((decorator) => decorator(CrudController.prototype, name, descriptor));
	};

	route('getCount', [common.Get('count')]);
	route('pagination', [common.Get('pagination')]);
	route('findAll', [common.Get()]);
	route('findById', [common.Get(':id')]);
	route('create', [common.Post(), common.HttpCode(common.HttpStatus.CREATED)]);
	route('update', [common.Put(':id'), common.HttpCode(common.HttpStatus.ACCEPTED)]);
	route('delete', [common.Delete(':id'), common.HttpCode(common.HttpStatus.ACCEPTED)]);
	route('softRemove', [common.Delete(':id/soft'), common.HttpCode(common.HttpStatus.ACCEPTED)]);
	route('softRecover', [common.Put(':id/recover'), common.HttpCode(common.HttpStatus.ACCEPTED)]);

	return {
		CrudController,
		// The real decorator, spelled out: it is what writes the metadata the guard reads.
		Permissions: (...permissions: string[]) => common.SetMetadata(PERMISSIONS_METADATA, permissions),
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// `@UsePipes()` and `@Param(..., Pipe)` both validate that a pipe exposes `transform`.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		ParseJsonPipe: class ParseJsonPipe {
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {
			transform(value: any): any {
				return value;
			}
		},
		TenantOrganizationBaseDTO: class TenantOrganizationBaseDTO {},
		BaseQueryDTO: class BaseQueryDTO {},
		UseValidationPipe:
			(..._args: any[]) =>
			() =>
				undefined
	};
});

jest.mock('./help-center/help-center.entity', () => ({ HelpCenter: class HelpCenter {} }));
jest.mock('./help-center/help-center.service', () => ({ HelpCenterService: class HelpCenterService {} }));
jest.mock('./help-center/commands', () => ({
	HelpCenterUpdateCommand: class HelpCenterUpdateCommand {},
	KnowledgeBaseBulkDeleteCommand: class KnowledgeBaseBulkDeleteCommand {}
}));

jest.mock('./help-center-article/help-center-article.entity', () => ({
	HelpCenterArticle: class HelpCenterArticle {}
}));
jest.mock('./help-center-article/help-center-article.service', () => ({
	HelpCenterArticleService: class HelpCenterArticleService {}
}));
jest.mock('./help-center-article/commands', () => ({
	KnowledgeBaseCategoryBulkDeleteCommand: class KnowledgeBaseCategoryBulkDeleteCommand {}
}));
jest.mock('./help-center-article/commands/help-center-article.update.command', () => ({
	HelpCenterUpdateArticleCommand: class HelpCenterUpdateArticleCommand {}
}));
jest.mock('./help-center-article/dto', () => ({
	UpdateHelpCenterArticleDTO: class UpdateHelpCenterArticleDTO {}
}));

jest.mock('./help-center-author/help-center-author.entity', () => ({
	HelpCenterAuthor: class HelpCenterAuthor {}
}));
jest.mock('./help-center-author/help-center-author.service', () => ({
	HelpCenterAuthorService: class HelpCenterAuthorService {}
}));
jest.mock('./help-center-author/commands', () => ({
	ArticleAuthorsBulkCreateCommand: class ArticleAuthorsBulkCreateCommand {},
	KnowledgeBaseArticleBulkDeleteCommand: class KnowledgeBaseArticleBulkDeleteCommand {}
}));

import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PermissionGuard } from '@gauzy/core';
import { HelpCenterController } from './help-center/help-center.controller';
import { HelpCenterArticleController } from './help-center-article/help-center-article.controller';
import { HelpCenterAuthorController } from './help-center-author/help-center-author.controller';

const MUTATING_METHODS = new Set<RequestMethod>([
	RequestMethod.POST,
	RequestMethod.PUT,
	RequestMethod.PATCH,
	RequestMethod.DELETE
]);

interface RouteDescriptor {
	name: string;
	method: RequestMethod;
	path: string;
	handler: (...args: any[]) => any;
	declaredOn: Function;
}

/**
 * Enumerates every HTTP route a controller exposes, walking the prototype chain the way Nest's own
 * MetadataScanner does — which is what makes the inherited `CrudController` routes visible.
 */
function collectRoutes(controller: Function): RouteDescriptor[] {
	const routes = new Map<string, RouteDescriptor>();

	let prototype = controller.prototype;
	let declaredOn: Function = controller;

	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (name === 'constructor' || routes.has(name)) {
				continue;
			}

			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);

			if (!descriptor || typeof descriptor.value !== 'function') {
				continue;
			}

			const method: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, descriptor.value);

			if (method === undefined) {
				continue;
			}

			routes.set(name, {
				name,
				method,
				path: Reflect.getMetadata(PATH_METADATA, descriptor.value),
				handler: descriptor.value,
				declaredOn
			});
		}

		prototype = Object.getPrototypeOf(prototype);
		declaredOn = prototype?.constructor;
	}

	return [...routes.values()];
}

function mutatingRoutes(controller: Function): RouteDescriptor[] {
	return collectRoutes(controller).filter((route) => MUTATING_METHODS.has(route.method));
}

function gateReport(controller: Function) {
	return mutatingRoutes(controller).map((route) => ({
		route: `${RequestMethod[route.method]} ${route.path} (${route.name})`,
		permissionGuard: (Reflect.getMetadata(GUARDS_METADATA, route.handler) ?? []).includes(PermissionGuard),
		permissions: Reflect.getMetadata(PERMISSIONS_METADATA, route.handler)
	}));
}

function expectAllGatedOnHelpCenterEdit(controller: Function): void {
	const report = gateReport(controller);

	expect(report.length).toBeGreaterThan(0);
	expect(report).toEqual(
		report.map((entry) => ({
			route: entry.route,
			permissionGuard: true,
			permissions: [PermissionsEnum.ORG_HELP_CENTER_EDIT]
		}))
	);
}

describe('Knowledge Base controllers', () => {
	it('the CrudController double mirrors the five inherited mutating routes of the real base class', () => {
		expect(
			mutatingRoutes(CrudController as unknown as Function)
				.map((route) => `${RequestMethod[route.method]} ${route.path}`)
				.sort()
		).toEqual(['DELETE :id', 'DELETE :id/soft', 'POST /', 'PUT :id', 'PUT :id/recover'].sort());
	});

	describe('HelpCenterArticleController', () => {
		it('gates every mutating route on ORG_HELP_CENTER_EDIT, inherited ones included', () => {
			expectAllGatedOnHelpCenterEdit(HelpCenterArticleController);
		});

		it('covers the reported routes and the inherited delete/soft-delete/recover routes', () => {
			const routes = mutatingRoutes(HelpCenterArticleController);

			expect(
				routes
					.filter((route) => route.declaredOn === HelpCenterArticleController)
					.map((route) => `${RequestMethod[route.method]} ${route.path}`)
					.sort()
			).toEqual(
				[
					'POST /',
					'POST :id/duplicate',
					'PUT :id/binary-description',
					'PATCH :id/description',
					'DELETE category/:categoryId',
					'PUT :id',
					'DELETE :id',
					'DELETE :id/soft',
					'PUT :id/recover'
				].sort()
			);
		});

		it('leaves the read routes open, which is by design — there is no Help Center view permission', () => {
			const reads = collectRoutes(HelpCenterArticleController).filter(
				(route) => route.method === RequestMethod.GET
			);

			expect(reads.length).toBeGreaterThan(0);

			for (const read of reads) {
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, read.handler)).toBeUndefined();
			}
		});
	});

	describe('HelpCenterController', () => {
		it('gates every mutating route on ORG_HELP_CENTER_EDIT, inherited ones included', () => {
			expectAllGatedOnHelpCenterEdit(HelpCenterController);
		});

		it('gates the bulk base delete that destroys a whole knowledge base', () => {
			const route = mutatingRoutes(HelpCenterController).find((candidate) => candidate.path === 'base/:baseId');

			expect(route?.method).toBe(RequestMethod.DELETE);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, route?.handler)).toEqual([
				PermissionsEnum.ORG_HELP_CENTER_EDIT
			]);
		});
	});

	describe('HelpCenterAuthorController', () => {
		it('gates every mutating route on ORG_HELP_CENTER_EDIT, inherited ones included', () => {
			expectAllGatedOnHelpCenterEdit(HelpCenterAuthorController);
		});
	});
});
