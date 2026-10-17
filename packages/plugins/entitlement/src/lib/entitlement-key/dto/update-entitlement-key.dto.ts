import { PartialType } from '@nestjs/mapped-types';
import { EntitlementKeyDTO } from './entitlement-key.dto';

/**
 * An edit to an issued key.
 *
 * The digest, the ciphertext and the state are closed: a key's state moves by being activated,
 * revoked or re-issued, each of which is an audited action, and a body that could set it would make
 * "this key was withdrawn" an unaudited field write.
 */
export class UpdateEntitlementKeyDTO extends PartialType(EntitlementKeyDTO) {}
