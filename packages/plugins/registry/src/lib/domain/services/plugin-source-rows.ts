import { ID } from '@gauzy/contracts';

/** Who a new plugin source row belongs to: decided by the server, never read from the request. */
export interface IPluginSourceOwner {
	/** The version the row is filed under; left unset when the version is created after its sources. */
	versionId?: ID;
	tenantId: ID;
	organizationId?: ID;
}

/**
 * The fields of a new plugin source row: the caller's description of the source, with the row's identity and owner set
 * by the server.
 *
 * Sources are saved through a raw repository. There an `id` from the request turned the insert into an update of that
 * row, in any tenant, and a `versionId` or `tenantId` from the request filed the row under another tenant's plugin
 * version: an author could point another tenant's plugin at their own download, which the desktop app then installs.
 *
 * The relation objects go too: TypeORM writes a foreign key from its relation when the row carries one, so a
 * `version: { id }`, `tenant: { id }` or `organization: { id }` from the request would win over the ids set here.
 *
 * @param source - The source as the request describes it.
 * @param owner - The version, tenant and organization the row belongs to.
 */
export function ownedSourceRow<T extends object>(source: T, owner: IPluginSourceOwner) {
	return {
		...source,
		id: undefined,
		version: undefined,
		versionId: owner.versionId,
		tenant: undefined,
		tenantId: owner.tenantId,
		organization: undefined,
		organizationId: owner.organizationId
	};
}
