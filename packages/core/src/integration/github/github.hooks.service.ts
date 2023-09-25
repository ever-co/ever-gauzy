import { Injectable } from '@nestjs/common';
import { Context } from 'probot';

@Injectable()
export class GithubHooksService {

    constructor() { }

    async issuesOpened(context: Context) {
        console.log('Issue Created: ', context.payload);
    }

    async issuesEdited(context: Context) {
        console.log('Issue Edited', context.payload);
    }
}
