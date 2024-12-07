// https://github.com/node-fetch/node-fetch/blob/main/docs/v3-UPGRADE-GUIDE.md#converted-to-es-module
module.export.fetch = function fetch(...args) {
    return import('node-fetch').then(({ default: fetch }) => fetch(...args));
}
