import { ITenantCreateInput } from "@gauzy/contracts";
import { ApiHideProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";
import { CHECKOUT_SESSION_ID_PATTERN } from "../../shared/billing/billing-product";
import { TenantDTO } from "./tenant.dto";

export class CreateTenantDTO extends TenantDTO implements ITenantCreateInput {

    @ApiHideProperty()
    @IsOptional()
    @IsBoolean()
    readonly isImporting: boolean;

    @ApiHideProperty()
    @IsOptional()
    readonly sourceId: string;

    @ApiHideProperty()
    @IsOptional()
    readonly userSourceId: string;

    /**
     * The Stripe Checkout Session the creator completed before registering. On a hosted deployment the
     * new tenant is linked to that session's customer, but only after the server has confirmed with
     * Stripe that the session is complete, for this product, and was paid under the creator's own
     * address. Never persisted on the tenant.
     */
    @ApiPropertyOptional({ type: () => String, description: 'Stripe Checkout Session id (cs_live_... / cs_test_...)' })
    @IsOptional()
    @IsString()
    @Matches(CHECKOUT_SESSION_ID_PATTERN, { message: 'stripeCheckoutSessionId is not a Stripe Checkout Session id.' })
    readonly stripeCheckoutSessionId?: string;
}
