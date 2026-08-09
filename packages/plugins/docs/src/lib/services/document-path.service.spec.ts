/**
 * Breadcrumb resolution and ancestor masking (`08-permissions-security.md` §3.2).
 *
 * The rule this pins is easy to get subtly wrong: a document is reachable by id on its **own**
 * visibility, but the names of its ancestors are not. A client that built the breadcrumb from
 * `?relations=parent` therefore either leaked a PRIVATE folder's name or lost the chain entirely —
 * so the walk happens server-side and an unreadable segment collapses to `{ id: null, restricted:
 * true }` with no other field at all.
 *
 * `@gauzy/core` boots the whole application graph on import, so the framework seams are mocked at
 * the module boundary; the service under test is the real one.
 */
const requestContext = {
	tenantId: 'tenant-1' as string | null
};

jest.mock(
	'@gauzy/core',
	() => ({
		RequestContext: {
			currentTenantId: () => requestContext.tenantId
		}
	}),
	{ virtual: true }
);
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('./document.service', () => ({ DocumentService: class {} }));
jest.mock('./document-access.service', () => ({ DocumentAccessService: class {} }));

import { NotFoundException } from '@nestjs/common';
import { DocumentKindEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import { DocumentPathService } from './document-path.service';

/** A row stub carrying only the columns the walk projects. */
const row = (id: string, parentId: string | null, overrides: Record<string, any> = {}) => ({
	id,
	name: `name-${id}`,
	kind: DocumentKindEnum.FOLDER,
	parentId,
	visibility: DocumentVisibilityEnum.ORGANIZATION,
	createdByUserId: 'user-1',
	organizationId: 'org-1',
	...overrides
});

/**
 * Builds the real service over stub collaborators.
 *
 * @param rows Every row the ancestor lookup may resolve, by id.
 * @param unreadable Ids the share/visibility evaluation must answer `false` for.
 */
const buildService = (rows: Record<string, any>, unreadable: string[] = []) => {
	const target = rows['leaf'];
	const documentService: any = {
		findOneScoped: jest.fn(async () => {
			if (!target) {
				throw new NotFoundException('Document leaf was not found');
			}
			return target;
		})
	};
	const accessService: any = {
		canRead: jest.fn(async (_projection: any, id: string) => !unreadable.includes(id))
	};
	const repository: any = {
		findOne: jest.fn(async ({ where }: any) => {
			const found = rows[where.id];
			if (!found || found.organizationId !== where.organizationId) {
				return null;
			}
			return found;
		})
	};
	return {
		service: new DocumentPathService(documentService, accessService, repository),
		documentService,
		accessService,
		repository
	};
};

describe('DocumentPathService', () => {
	beforeEach(() => {
		requestContext.tenantId = 'tenant-1';
	});

	it('returns the chain root → document, inclusive', async () => {
		const { service } = buildService({
			root: row('root', null),
			mid: row('mid', 'root'),
			leaf: row('leaf', 'mid', { kind: DocumentKindEnum.PAGE })
		});

		await expect(service.getPath('leaf')).resolves.toEqual([
			{ id: 'root', name: 'name-root', kind: DocumentKindEnum.FOLDER },
			{ id: 'mid', name: 'name-mid', kind: DocumentKindEnum.FOLDER },
			{ id: 'leaf', name: 'name-leaf', kind: DocumentKindEnum.PAGE }
		]);
	});

	it('masks an unreadable ancestor with no name, id or kind', async () => {
		const { service } = buildService(
			{
				root: row('root', null),
				secret: row('secret', 'root', {
					visibility: DocumentVisibilityEnum.PRIVATE,
					createdByUserId: 'user-2'
				}),
				leaf: row('leaf', 'secret', { kind: DocumentKindEnum.PAGE })
			},
			['secret']
		);

		const path = await service.getPath('leaf');

		expect(path[1]).toEqual({ id: null, restricted: true });
		expect(JSON.stringify(path)).not.toContain('name-secret');
	});

	it('keeps walking past a masked ancestor so readable roots still render', async () => {
		const { service } = buildService(
			{
				root: row('root', null),
				secret: row('secret', 'root'),
				leaf: row('leaf', 'secret')
			},
			['secret']
		);

		const path = await service.getPath('leaf');

		expect(path.map((segment) => segment.id)).toEqual(['root', null, 'leaf']);
	});

	it('ends the chain at a dangling parent id instead of failing the request', async () => {
		const { service } = buildService({ leaf: row('leaf', 'missing') });

		await expect(service.getPath('leaf')).resolves.toEqual([
			{ id: 'leaf', name: 'name-leaf', kind: DocumentKindEnum.FOLDER }
		]);
	});

	it('terminates on a parent cycle rather than spinning the request', async () => {
		const rows: Record<string, any> = {
			leaf: row('leaf', 'a'),
			a: row('a', 'b'),
			b: row('b', 'a')
		};
		const { service } = buildService(rows);

		const path = await service.getPath('leaf');

		expect(path.map((segment) => segment.id)).toEqual(['b', 'a', 'leaf']);
	});

	it('scopes the ancestor lookup to the document organization and the request tenant', async () => {
		const { service, repository } = buildService({
			root: row('root', null),
			leaf: row('leaf', 'root')
		});

		await service.getPath('leaf');

		expect(repository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'root', tenantId: 'tenant-1', organizationId: 'org-1' }
			})
		);
	});

	it('never resolves a path for a document outside the read scope', async () => {
		const { service } = buildService({});

		await expect(service.getPath('leaf')).rejects.toBeInstanceOf(NotFoundException);
	});
});
