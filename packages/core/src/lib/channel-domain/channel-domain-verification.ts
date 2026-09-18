import { IChannelDomain, ID } from '@gauzy/contracts';
import { ChannelDomainService } from './channel-domain.service';

/**
 * What a verification of one hostname answers.
 */
export interface IChannelDomainVerification {
	/** Whether the hostname resolves to the channel it is bound to. */
	readonly verified: boolean;
	/** The channel the hostname resolved to, or `null` when it resolved to none. */
	readonly resolvedTo: ID | null;
	/** When the check ran. */
	readonly checkedAt: Date;
}

/**
 * Answers whether a hostname reaches the channel it is bound to.
 *
 * **What this check is, and what it is not.** The endpoint table asks for "DNS/TLS readiness of the
 * hostname", and the platform holds no resolver and no certificate probe: the delivered service
 * offers exactly one question about a host — {@link ChannelDomainService.resolveChannelIdByHostname},
 * the same read the request guard makes before it decides anything — so that is the question this
 * answers, and the answer is named for what it means rather than for what it does not.
 *
 * It is the useful half. A binding whose hostname resolves to no channel is a storefront no request
 * can reach (invariant I-25), and that is decided entirely inside this table plus the normaliser both
 * paths share. Whether a certificate is installed in front of the host is a deployment question whose
 * answer is not in this database, and inventing an answer here would be worse than not answering.
 *
 * @param service The hostname service.
 * @param domain The bound hostname row to verify.
 * @returns The verification: whether it resolves, to what, and when it was checked.
 */
export async function verifyChannelDomain(
	service: ChannelDomainService,
	domain: IChannelDomain
): Promise<IChannelDomainVerification> {
	const resolvedTo = await service.resolveChannelIdByHostname(domain.hostname);

	return {
		verified: Boolean(resolvedTo) && String(resolvedTo) === String(domain.channelId),
		resolvedTo: resolvedTo ?? null,
		checkedAt: new Date()
	};
}
