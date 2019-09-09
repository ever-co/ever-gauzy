import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt')
{

    constructor(/*private readonly authService: AuthService*/)
    {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: '+RudOJ3WWsw/+g0DZNkjvHjoNUJGXUlpJ7iRjKFZ7zRoFJsrMqiBB5FGyj14GqG1acUm3lr0mVfkkzQqD89zSYzZLTh+atvQ6UcGKZShqSFFLkYqqpR0s+4UG2QawsDqaB81I9mkJkGJallAQ/odkxKGcBpV3qSQPBrupE4UhtrCDsRi3yu+jiBkmyBC9uJCB2/qw8iaKttKxhv9Y/YW98hY7ewrE5Pr1pkg7OJOe3NdEr8/Y4az0g4Pj/pqp33vR1uMAoAt33vciKtSgg9OdX5SgP5PAh6IDfJkfT2622NjVQwUXmSI0gVdETiYR1YLzfe45jm+HPkeP37Q/RSj+Q=='
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
