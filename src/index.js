require('dotenv').config();
const http = require("http");
const { router } = require('./router');
const { initWebSocket } = require('./ws');

const server = http.createServer(router);

initWebSocket(server); // attach Web Socket to same server

server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});