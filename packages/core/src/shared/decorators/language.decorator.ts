import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { LanguagesEnum } from '@gauzy/contracts';

export const Language = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const headers = request.headers;
        return headers['language'] || LanguagesEnum.ENGLISH;
    }
);