import { Injectable } from '@nestjs/common';
import { ApolloDriver } from '@nestjs/apollo';
import { runInFreshMikroOrmContext } from '../../core/context/mikro-orm-context';
import { getORMType, MultiORMEnum } from '../../core/utils';
import { renewRelationLoaders } from '../graphql-context';

/**
 * A `@Subscription` filter, as the driver is handed it.
 */
type SubscriptionFilter = (payload: unknown, variables: unknown, context: unknown) => boolean | Promise<boolean>;

/**
 * Evaluates a `@Subscription` filter on a fresh MikroORM fork each time it runs, under DB_ORM=mikro-orm.
 *
 * The Apollo driver applies the filter as the stream is read, and one read may run it many times: a candidate the
 * filter rejects is dropped and the next one awaited inside the same `next()`, which can span hours. Each pull runs on
 * a fork of its own (`forkMikroOrmContextPerPull`), so every candidate of one pull would otherwise share that fork, and
 * a filter that reads a row through a repository would decide a later candidate on the entity an earlier one loaded
 * into its identity map rather than on the row as it is now. Each evaluation now forks the context in force — the
 * pull's — afresh; the event the filter accepts is still executed on the pull's own fork.
 *
 * The filter is called synchronously as before, and what it answers or throws reaches the driver unchanged. Under
 * TypeORM the filter is handed back as it is.
 *
 * @param filter The filter.
 * @returns The filter, each evaluation on a fork of its own.
 */
export function forkMikroOrmContextPerFilter<F extends SubscriptionFilter>(filter: F): F {
	if (typeof filter !== 'function' || getORMType() !== MultiORMEnum.MikroORM) {
		return filter;
	}

	return function (this: unknown, ...args: Parameters<F>) {
		return runInFreshMikroOrmContext(() => filter.apply(this, args));
	} as F;
}

/**
 * Hands the GraphQL context a fresh relation-loader registry each time a `@Subscription` filter is asked about a
 * candidate, under either ORM.
 *
 * The filter is called with the operation's context (`(payload, variables, context)`), so it may resolve a relation
 * through `context.loaders`. One pull of the stream can span many candidates the filter rejects, and the stream renews
 * its loaders once per pull (`renewRelationLoadersPerPull`): without this, the candidate the filter accepts would be
 * decided, and then resolved, on what an earlier rejected one had loaded — possibly hours before. Each evaluation now
 * starts a registry of its own, which the accepted candidate's execution then shares, as one event's resolution does.
 *
 * The filter is called synchronously as before, and what it answers or throws reaches the driver unchanged. A context
 * the platform's factory did not build is left as it is.
 *
 * @param filter The filter.
 * @returns The filter, each evaluation with relation loaders of its own.
 */
export function renewRelationLoadersPerFilter<F extends SubscriptionFilter>(filter: F): F {
	if (typeof filter !== 'function') {
		return filter;
	}

	return function (this: unknown, ...args: Parameters<F>) {
		renewRelationLoaders(args[2]);
		return filter.apply(this, args);
	} as F;
}

/**
 * The Apollo driver the platform serves GraphQL with: Apollo's own, with each `@Subscription` filter evaluated on a
 * fresh MikroORM fork under DB_ORM=mikro-orm ({@link forkMikroOrmContextPerFilter}) and, under either ORM, with
 * relation loaders of its own ({@link renewRelationLoadersPerFilter}). Everything else is Apollo's driver, unchanged.
 *
 * The driver is where `@nestjs/graphql` hands every filter a resolver declares (`ResolversExplorerService`), so this is
 * the one place each evaluation can be given a context of its own without asking every resolver to open one.
 */
@Injectable()
export class MikroOrmAwareApolloDriver extends ApolloDriver {
	/**
	 * @param instanceRef The resolver the filter belongs to.
	 * @param filterFn The filter.
	 * @param createSubscribeContext What builds the resolver's subscribe function.
	 * @returns The field's subscribe function, its filter evaluated on a fork and with loaders of its own each time.
	 */
	override subscriptionWithFilter(
		instanceRef: unknown,
		filterFn: SubscriptionFilter,
		createSubscribeContext: Parameters<ApolloDriver['subscriptionWithFilter']>[2]
	) {
		return super.subscriptionWithFilter(
			instanceRef,
			forkMikroOrmContextPerFilter(renewRelationLoadersPerFilter(filterFn)),
			createSubscribeContext
		);
	}
}
