import { ClsServiceManager } from 'nestjs-cls';
import { RequestContext } from '../context/request-context';

/** Whether this process has confirmed that `RequestContext.runWithRequest` opens a store. */
let storeConfirmed = false;

/** Whether `RequestContext.runWithRequest` opens a store in this process (the probe reads its own request back). */
function opensStore(): boolean {
	const probe = { headers: {}, query: {}, params: {}, body: {} };
	try {
		return RequestContext.runWithRequest(probe as never, () => RequestContext.currentRequest() === probe) === true;
	} catch {
		return false;
	}
}

/**
 * Makes sure `RequestContext.runWithRequest` opens a real store in this process. The API's `AppModule` attaches the
 * request-context store; a process that never booted it (a worker) has none, and the process-wide nestjs-cls store is
 * attached instead. Cheap after the first confirmation.
 */
function ensureRequestContextStore(): void {
	if (storeConfirmed) return;
	if (opensStore()) {
		storeConfirmed = true;
		return;
	}
	const store = ClsServiceManager.getClsService();
	if (!store) return;
	RequestContext.setClsService(store);
	storeConfirmed = opensStore();
}

/**
 * Runs storage work with a tenant's own storage settings, where no signed-in request carries them: a queue job, a
 * sweep, any background step.
 *
 * A tenant can keep its own storage in its settings (the provider, an S3 / Wasabi / DigitalOcean bucket and its
 * credentials). `FileStorage` and the providers read them from the current request (`tenantSettings`, which
 * `TenantSettingsMiddleware` attaches to a signed-in request). Without a request they use the deployment's defaults,
 * so a background read of a tenant's file looks in the wrong bucket, and a background write stores it there.
 *
 * `work` runs in a request context of its own, on a fresh store, so nothing of an enclosing request leaks in and
 * nothing of this one leaks out. Its request carries only the settings, with no user, so it grants no access.
 * Every provider call of the work must start inside `work`: `getProvider()` and `getProviderInstance()` read the
 * settings when they are called.
 *
 * @param tenantSettings - The tenant's own settings (name → value), as the settings middleware attaches them.
 * @param work - The storage work.
 * @returns Whatever `work` returns.
 */
export async function runWithTenantStorageSettings<T>(
	tenantSettings: Record<string, unknown> | null | undefined,
	work: () => Promise<T>
): Promise<T> {
	ensureRequestContextStore();
	const request = { tenantSettings: { ...(tenantSettings ?? {}) }, headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(request as never, work);
}
