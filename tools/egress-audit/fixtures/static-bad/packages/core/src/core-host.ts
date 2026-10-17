// A known-bad fixture for static-hostnames.test.mjs: core code calling Ever Platform by itself.
export const platform = process.env.EVER_PLATFORM_API_URL ?? 'https://api.ever.co';
