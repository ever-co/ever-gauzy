/**
 * The module doubles of the Inbox email GraphQL specs: `@gauzy/core` (its barrel boots the whole application) and
 * `@gauzy/common`, with every export the Inbox email module's files read, so the module and the plugin load and their
 * metadata can be asserted. Guards are named classes, `@Permissions` and `@FeatureFlag` record their values, and the
 * UUID pipe refuses what the real one refuses.
 *
 * Used from a `jest.mock` factory:
 * `jest.mock('@gauzy/core', () => jest.requireActual('../testing/graphql-core-double').coreDouble())`.
 */
import { NotAcceptableException, SetMetadata } from '@nestjs/common';

export function coreDouble(): Record<string, unknown> {
	const decorator = () => () => undefined;
	return {
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		UseValidationPipe: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		BaseEntityEventSubscriber: class {},
		Employee: class {},
		UserOrganization: class {},
		FileStorage: class {},
		EmailSendService: class {},
		EmailSendModule: class EmailSendModule {},
		RolePermissionModule: class RolePermissionModule {},
		EVER_REDIS_CLIENT: 'EVER_REDIS_CLIENT',
		WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: 300,
		describeEmailSendError: (error: unknown) => String((error as Error)?.message ?? error),
		getEmailTransportRegistry: () => ({ register: () => undefined, unregister: () => undefined }),
		verifyWebhookSignature: () => false,
		RequestContext: {
			currentTenantId: () => null,
			currentUserId: () => null,
			currentOrganizationId: () => null,
			hasPermission: () => false
		},
		FEATURE_GRAPHQL: 'FEATURE_GRAPHQL',
		FeatureFlagGuard: class FeatureFlagGuard {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		Permissions: (...permissions: string[]) => SetMetadata('permissions', permissions),
		UUIDValidationPipe: class UUIDValidationPipe {
			transform(value: string) {
				if (!/^[0-9a-f-]{36}$/i.test(value ?? '')) {
					throw new NotAcceptableException('Validation failed (valid uuid is expected)');
				}
				return value;
			}
		}
	};
}

/** `@gauzy/common`: `@FeatureFlag` records its code, `@Public` does nothing. */
export function commonDouble(): Record<string, unknown> {
	return {
		FeatureFlag: (flag: string) => SetMetadata('feature', flag),
		Public: () => () => undefined
	};
}

/** `@gauzy/plugin`: the plugin decorator records what the plugin declares (the real one loads the configuration). */
export function pluginDouble(): Record<string, unknown> {
	return {
		GauzyCorePlugin: (metadata: unknown) => (target: { declared?: unknown }) => {
			target.declared = metadata;
		}
	};
}
