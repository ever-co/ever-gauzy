import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PaymentProvider } from './payment-provider.entity';
import { TypeOrmPaymentProviderRepository } from './repository/type-orm-payment-provider.repository';
import { MikroOrmPaymentProviderRepository } from './repository/mikro-orm-payment-provider.repository';
import { PaymentScopedCrudService } from '../payment-scoped-crud.service';
import { IPaymentProvider, IPaymentProviderCreateInput, IPaymentProviderUpdateInput } from '../payment.types';
import { findSecretConfigurationKey } from '../payment.validators';

/**
 * The provider registry.
 *
 * Every read and every write is scoped to the caller's tenant and organization, so one tenant can
 * never see or edit another's registrations. The service owns the three rules the table alone cannot
 * express:
 *
 * 1. **The code is unique per organization and immutable once used.** It is the key the provider
 *    strategy is resolved from, so re-pointing it would silently move every session that references
 *    the row onto a different adapter.
 * 2. **Credentials never live here.** `configuration` is refused when it carries a key that names a
 *    secret, because a secret in a provider row is a second, unmanaged copy of a credential that the
 *    integration registry already holds, wrapped and rotated.
 * 3. **A disabled provider is refused loudly.** A registration with `isEnabled = false` is not
 *    silently dropped from a session attempt; the attempt fails with `PAYMENT_PROVIDER_DISABLED`, so
 *    an operator learns that the provider was withdrawn rather than watching a payment vanish.
 */
@Injectable()
export class PaymentProviderService extends PaymentScopedCrudService<PaymentProvider> {
	constructor(
		readonly typeOrmPaymentProviderRepository: TypeOrmPaymentProviderRepository,
		readonly mikroOrmPaymentProviderRepository: MikroOrmPaymentProviderRepository
	) {
		super(typeOrmPaymentProviderRepository, mikroOrmPaymentProviderRepository);
	}

	/**
	 * Registers a provider inside the caller's tenant and organization.
	 *
	 * @param input The registration to create.
	 * @returns The stored registration.
	 * @throws BadRequestException when the code or the name is missing, when the code is already
	 * registered in the organization, or when the configuration carries a credential.
	 */
	async createProvider(input: IPaymentProviderCreateInput): Promise<IPaymentProvider> {
		const code = input.code?.trim();
		const name = input.name?.trim();

		if (!code) {
			throw new BadRequestException('PAYMENT_PROVIDER_CODE_REQUIRED');
		}

		if (!name) {
			throw new BadRequestException('PAYMENT_PROVIDER_NAME_REQUIRED');
		}

		this.assertNoSecret(input.configuration, input.metadata);

		const existing = await this.findProviderByCode(code);

		if (existing) {
			throw new BadRequestException(`Payment provider '${code}' is already registered in this organization.`);
		}

		return this.create({
			...input,
			code,
			name,
			isEnabled: input.isEnabled ?? true,
			isTestMode: input.isTestMode ?? false,
			sortOrder: input.sortOrder ?? 0,
			...this.scope
		} as never);
	}

	/**
	 * Updates a registration of the caller's organization.
	 *
	 * The code may not change: it is the key the adapter is resolved from. Disabling a provider is an
	 * ordinary update of `isEnabled`, and the sessions already on record keep resolving.
	 *
	 * @param id The registration to update.
	 * @param input The fields to change.
	 * @returns The stored registration.
	 * @throws NotFoundException when the registration is not in the caller's organization.
	 * @throws BadRequestException when the code would change or the configuration carries a credential.
	 */
	async updateProvider(id: ID, input: IPaymentProviderUpdateInput): Promise<IPaymentProvider> {
		const provider = await this.findProviderOrFail(id);

		if (input.code && input.code.trim() !== provider.code) {
			throw new BadRequestException(
				`Payment provider code '${provider.code}' is the key its adapter is resolved from and cannot change.`
			);
		}

		this.assertNoSecret(input.configuration, input.metadata);

		const { code, ...changes } = input;
		void code;

		await this.update(id, { ...changes } as never);

		return this.findProviderOrFail(id);
	}

	/**
	 * Loads a registration that belongs to the caller's organization.
	 *
	 * @param id The registration to load.
	 * @returns The registration.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findProviderOrFail(id: ID): Promise<IPaymentProvider> {
		const provider = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!provider) {
			throw new NotFoundException('PAYMENT_PROVIDER_NOT_FOUND');
		}

		return provider;
	}

	/**
	 * Resolves a registration by its code, which is the key a callback carries.
	 *
	 * **Absence is an answer here, not a refusal.** The read is the pair's fail-soft half —
	 * `findOneOrFailByWhereOptions`, whose `ITryRequest` carries `success: false` — because the code
	 * being free is the ordinary state of the registry, and a nullable read that raises instead turns
	 * "no registration claims this code" into a refusal the caller has to catch to make sense of.
	 *
	 * @param code The provider code.
	 * @returns The registration, or null when this organization has none with that code.
	 */
	async findProviderByCode(code: string): Promise<IPaymentProvider | null> {
		const outcome = await this.findOneOrFailByWhereOptions({
			code: code?.trim(),
			...this.scope
		} as never);

		return outcome.success ? (outcome.record as IPaymentProvider) : null;
	}

	/**
	 * Resolves a registration by its identifier, for a caller that must not fail when it is absent.
	 *
	 * The same fail-soft read as `findProviderByCode`: a caller that branches on the absence — the
	 * callback intake, which reports a provider it cannot resolve under
	 * `PAYMENT_WEBHOOK_UNKNOWN_PROVIDER` — needs the miss as a value rather than as an exception.
	 *
	 * @param id The registration identifier.
	 * @returns The registration, or null when this organization has none with that identifier.
	 */
	async findProviderOrNull(id: ID): Promise<IPaymentProvider | null> {
		const outcome = await this.findOneOrFailByWhereOptions({ id, ...this.scope } as never);

		return outcome.success ? (outcome.record as IPaymentProvider) : null;
	}

	/**
	 * Paginates the registrations of the caller's organization, in the order the payment step shows
	 * them.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of registrations.
	 */
	async findProviders(options: Record<string, unknown> = {}): Promise<IPagination<IPaymentProvider>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Lists the providers that may be offered to a buyer: registered and enabled, in display order.
	 *
	 * @returns The offerable registrations.
	 */
	async findEnabledProviders(): Promise<IPaymentProvider[]> {
		return this.find({ where: { ...this.scope, isEnabled: true } as never, order: { sortOrder: 'ASC' } as never });
	}

	/**
	 * Refuses a registration that is disabled, at the moment a session would use it.
	 *
	 * @param provider The registration to test.
	 * @throws BadRequestException when it is disabled.
	 */
	assertEnabled(provider: IPaymentProvider): void {
		if (!provider.isEnabled) {
			throw new BadRequestException('PAYMENT_PROVIDER_DISABLED');
		}
	}

	/**
	 * Refuses a configuration or metadata document that carries a credential.
	 *
	 * The check is recursive and case-insensitive, so `apiKey`, `api_key` and `payment.apiKey` are one
	 * name, and it runs on write only — a value that was stored before this rule existed is still
	 * readable, and an operator can correct it.
	 *
	 * @param configuration The configuration to inspect.
	 * @param metadata The metadata to inspect.
	 * @throws BadRequestException naming the offending member.
	 */
	private assertNoSecret(configuration?: Record<string, unknown>, metadata?: Record<string, unknown>): void {
		for (const [label, document] of [
			['configuration', configuration],
			['metadata', metadata]
		] as const) {
			const member = findSecretConfigurationKey(document);

			if (member) {
				throw new BadRequestException(
					`PAYMENT_PROVIDER_SECRET_NOT_ALLOWED: '${label}.${member}' is a credential. Provider credentials belong in the integration settings this registration points at.`
				);
			}
		}
	}
}
