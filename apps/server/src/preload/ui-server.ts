const http = require('http');
const fs = require('fs');
const path = require('path');
const static = require('node-static');
const dirUi = path.join(__dirname, '..', '..', 'data', 'ui');
const file = new(static.Server)(dirUi);
const url = require('url');
console.log('server started');

async function runServer() {
    http.createServer(function (req, res) {
        file.serve(req, res);
        console.log('server ui started');
        console.log(url.parse(req.url, true).query);
    }).listen(8084, '0.0.0.0', (data) => {
        console.log('listening to 8084');
    });
    return true;
}

runServer();