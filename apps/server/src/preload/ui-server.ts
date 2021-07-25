
import http from 'http';
import path from 'path';
const serverStatic = require('node-static');
const dirUi = process.env.isPackaged === 'true' ? path.join(__dirname, '..', '..', 'data', 'ui') : path.join(__dirname, '..', 'data', 'ui');
const file = new(serverStatic.Server)(dirUi);
const url = require('url');
console.log('server started');

async function runServer() {
    http.createServer(function (req, res) {
        file.serve(req, res);
        console.log('server ui started');
        console.log(url.parse(req.url, true).query);
    }).listen(8084, '0.0.0.0', () => {
        console.log('listen ui on port 8084');
    })
    return true;
}

runServer();