module.export.fetch = function fetch(...args) {
    return import('node-fetch').then(({ default: fetch }) => fetch(...args));
}