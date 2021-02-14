import express from 'express';
import { createServer, Server } from 'http';
import bodyParser from 'body-parser';

import controller from './controller';

const app = express();

app.use(bodyParser.json());
app.use(controller);

const server = createServer(app);
server.listen(process.env.PORT || 5000);
