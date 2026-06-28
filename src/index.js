require('dotenv').config();
const http = require("http");
const { router } = require('./router');

const server = http.createServer(router);

server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});