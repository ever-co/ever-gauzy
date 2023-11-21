import { registerAs } from '@nestjs/config';

export default registerAs('github', () => ({
    clientId: process.env.GAUZY_GITHUB_OAUTH_CLIENT_ID,
    clientSecret: process.env.GAUZY_GITHUB_OAUTH_CLIENT_SECRET,
    callbackAPIUrl: process.env.GAUZY_GITHUB_OAUTH_CALLBACK_URL || `${process.env.API_BASE_URL}/api/auth/github/callback`
}));
