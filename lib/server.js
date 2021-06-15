/*
 * Server-related tasks
 */

// Dependencies
const http = require('http');
const https = require('https');
const { URL } = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const util = require('util');
const debug = util.debuglog('server');

// Instantiate the server model object
const server = {};

// Instantiate the HTTP server
server.httpServer = http.createServer((req, res) => {
  server.unifiedServer(req, res);
});

// Instantiate the HTTPS server
server.httpsServerOptions = {
  key: fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '/../https/cert.pem')),
};
server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
  server.unifiedServer(req, res);
});

// All the sever logic for both the http and https sever
server.unifiedServer = (req, res) => {
  // Get the URL and parse it
  const parsedUrl = new URL(req.url, 'http://localhost:3000/');

  // Get the path and trim it using regex, get the query string as an object
  const { pathname, searchParams } = parsedUrl;
  const trimmedPath = pathname.replace(/^\/+|\/+$/g, '');
  const queryStringObject = searchParams;

  // Get the HTTP Method nad headers
  const { method, headers } = req;

  // Get the payload, if any
  const decoder = new StringDecoder('utf-8');
  let buffer = '';

  req.on('data', data => {
    buffer += decoder.write(data);
  });

  req.on('end', () => {
    buffer += decoder.end();

    // Choose the handler this request should go to. If one is not found, use the not found handler
    const chosenHandler =
      typeof server.router[trimmedPath] !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

    // Construct the data object to send to the handler
    const data = {
      trimmedPath: trimmedPath,
      queryStringObject: queryStringObject,
      method: method.toLowerCase(),
      headers: headers,
      payload: helpers.parseJsonToObject(buffer),
    };

    // Route the request to the handler specified in the router
    chosenHandler(data, (statusCode, payload, contentType) => {
      // Deteermine the type of response (callback to JSON)
      contentType = typeof contentType == 'string' ? contentType : 'json';
      // Use the status code called back by the handler or default to 200
      statusCode = typeof statusCode == 'number' ? statusCode : 200;

      // Convert the payload to a string
      const payloadStrings = JSON.stringify(payload);

      // Return the response parts that are content-specific
      let payloadString = '';
      if (contentType == 'json') {
        res.setHeader('Content-Type', 'application/json');
        payload = typeof payload == 'object' ? payload : {};
        payloadString = JSON.stringify(payload);
      }
      if (contentType == 'html') {
        res.setHeader('Content-Type', 'text/html');
        payloadString = typeof payload == 'string' ? payload : '';
      }

      // Return the response-parts that are common to all content-types
      res.writeHead(statusCode);
      res.end(payloadStrings);
      // If the response is 200, print green otherwise print red
      if (statusCode == 200) {
        debug('\x1b[32m%s\x1b[0m', method.toUpperCase() + '/' + trimmedPath + ' ' + statusCode);
      } else {
        debug('\x1b[31m%s\x1b[0m', method.toUpperCase() + '/' + trimmedPath + ' ' + statusCode);
      }
    });
  });
};

// Define a request router
server.router = {
  '': handlers.index,
  'account/create': handlers.accountCreate,
  'account/eidt': handlers.accountEdit,
  'account/deleted': handlers.accountDeleted,
  'session/create': handlers.sessionCreate,
  'session/deleted': handlers.sessionDeleted,
  'checks/all': handlers.checksList,
  'checks/create': handlers.checksCreate,
  'checks/edit': handlers.checksEdit,
  ping: handlers.ping,
  'api/users': handlers.users,
  'api/tokens': handlers.tokens,
  'api/checks': handlers.checks,
};

// Init script
server.init = function () {
  // Start the HTTP server
  server.httpServer.listen(config.httpPort, () => {
    console.log('\x1b[36m%s\x1b[0m', `The server is listening on port ${config.httpPort}`);
  });

  // Start the HTTPS server
  server.httpsServer.listen(config.httpsPort, () => {
    console.log('\x1b[35m%s\x1b[0m', `The server is listening on port ${config.httpsPort}`);
  });
};

// Export the module
module.exports = server;
