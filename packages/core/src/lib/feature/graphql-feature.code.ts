import { FeatureEnum } from '@gauzy/contracts';

/**
 * The capability that gates the GraphQL surface: the catalogue's own `FEATURE_GRAPHQL`, stated once.
 *
 * `commerce-feature-catalogue.ts` declares this code as "the GraphQL endpoint and its resolvers, under
 * the same guards and permissions as REST", and it is what makes the gate a rule rather than an
 * invention: every `@Resolver` this platform ships carries `@FeatureFlag(FEATURE_GRAPHQL)` on the
 * class and `FeatureFlagGuard` appended to the guard chain its own routes already run under, so a
 * tenant that switches the capability off is answered the way a disabled capability's REST routes
 * are — `Cannot query field <name>` — instead of being served by whichever resolvers happened to
 * carry the gate.
 *
 * **Why this is a constant and not a literal in each resolver.** The value has to agree with the
 * catalogue's `code`, and nothing checks one string against another: the compiler sees two unrelated
 * literals, and a spec that asserts "the class metadata carries the code" would have to state a third
 * copy to compare against. A resolver whose literal drifted — a typo, a rename applied to one file —
 * names a code no catalogue row carries, which `FeatureFlagGuard` resolves as disabled: every field
 * of that resolver then answers `Cannot query field <name>` for every caller, including the
 * administrator who switched the capability on. That failure is silent by construction — the build is
 * green, the boot is clean, the schema is complete, and only the requests are missing — so the code is
 * stated here once and imported, and `tools/scripts/graphql-feature-gate-check.mjs` holds every
 * resolver to it.
 *
 * It is carried as text because that is what it is, for the reasons the catalogue's module already
 * states at length: the compiled `FeatureEnum` belongs to the platform and a package does not edit it
 * to register a code; `feature.code` is a `varchar` holding this text, the packages declare these
 * codes as text, and the guard compares text — so this is the value, not a cast of one. The cast into
 * the shape the guard reads its metadata in is the same one the plugin feature modules make for their
 * own codes.
 *
 * It lives beside the catalogue rather than in the shared guards barrel because the catalogue is what
 * it has to agree with: whoever changes a code reads the two together.
 */
export const FEATURE_GRAPHQL: FeatureEnum = 'FEATURE_GRAPHQL' as unknown as FeatureEnum;
