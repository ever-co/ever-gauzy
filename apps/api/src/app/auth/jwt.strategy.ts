import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { environment as env } from '@env-api/environment';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt')
{

    constructor(/*private readonly authService: AuthService*/)
    {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: env.JWT_SECRET
        });
    }

    async validate(payload, done: Function)
    {
        try
        {
            // You could add a function to the authService to verify the claims of the token:
            // i.e. does the user still have the roles that are claimed by the token
            //const validClaims = await this.authService.verifyTokenClaims(payload);

            //if (!validClaims)
            //    return done(new UnauthorizedException('invalid token claims'), false);

            done(null, payload);
        }
        catch (err)
        {
            throw new UnauthorizedException('unauthorized', err.message);
        }
    }

}
