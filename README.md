# optics-agent-js
Optics Agent for GraphQL-js

Here are the steps to enable Optics Agent in your app. See below for details on each step:
* Install the NPM package in your app: `npm install optics-agent --save`
* In your main.js file:
 * Import the package: `import OpticsAgent from 'optics-agent'`;
 * Create the agent: `const agent = new OpticsAgent;`
 * Instrument your schema: `agent.instrumentSchema(executableSchema);`
 * Add the middleware: `expressServer.use(agent.middleware());`
 * Add to your GraphQL context object: `context.opticsContext = agent.context(req);`

## Install

First, install the package

```
npm install optics-agent --save
```

## Configure

Next, setup the agent in your main server file.

### Import the package

```
var OpticsAgent = require('optics-agent').OpticsAgent;
```

or in ES6

```
import OpticsAgent from 'optics-agent';
```

### Create the agent

```
var agent = new OpticsAgent({ configOptions })
```

Normally you do not need to pass any options here -- just set the `OPTICS_API_KEY` environment variable.

Options include:

* `apiKey`: String. Your API key for the Optics service. This defaults to the `OPTICS_API_KEY` environtment variable, but can be overriden here.

* `reportTraces`: Boolean: Send detailed traces along with usage reports. Defaults to true.

* `normalizeVersion`: Function(req)->[String,String]. Called to determine the client platform and version for a request. You may want to override this to improve client detection, eg, if you have a custom user-agent for a mobile client.

* `normalizeQuery`: Function(info)->String. Called to determine the query shape for for a GraphQL query. You shouldn't need to set this unless you are debugging.

* `debugFn`: Function(args). Called to print debugging messages. Defaults to `console.log`. To silence optics if `console.log` is not OK in your environment, pass `debugFn: () => {}`.

* `endpointUrl`: String. Where to send the reports. Defaults to the production Optics endpoint, or `OPTICS_ENDPOINT_URL` if it is set. You shouldn't need to set this unless you are debugging.

* `reportIntervalMs`: Int. How often to send reports in milliseconds. Defaults to 1 minute. You shouldn't need to set this unless you are debugging.

* `printReports`: Boolean: Print reports as the are sent. This may be useful for debugging. Defaults to false.


### Instrument your schema

Call `instrumentSchema` on the same executable schema object you pass to `graphql-js` to run.

```
agent.instrumentSchema(executableSchema);
```

You should only call this once per agent. If you have multiple or dynamic schemas, create a separate agent per schema.

### Add the middleware

Setup middleware:

#### Express
```
expressServer.use(agent.middleware());
```
Do this right before your GraphQL server for best results.

#### HAPI
```
agent.registerHapiExtensions(hapiServer)
```


### Add a context to each graphql request

In the `context` object sent to graphql, add a new field:
```
{ opticsContext: agent.context(req) }
```

If you are using HAPI you must explicitly use the raw request object:
```
{ opticsContext: agent.context(request.raw.req) }
```

### Example

Here's an example diff:

https://github.com/apollostack/GitHunt-API/compare/nim/optics-agent

```diff
diff --git a/api/index.js b/api/index.js
index 43ee586..d848ac0 100644
--- a/api/index.js
+++ b/api/index.js
@@ -19,6 +19,11 @@ import { subscriptionManager } from './subscriptions';
 
 import schema from './schema';
 
+import OpticsAgent from 'optics-agent';
+const agent = new OpticsAgent;
+agent.instrumentSchema(schema);
+
+
 let PORT = 3010;
 if (process.env.PORT) {
   PORT = parseInt(process.env.PORT, 10) + 100;
@@ -33,6 +38,7 @@ app.use(bodyParser.json());
 
 setUpGitHubLogin(app);
 
+app.use('/graphql', agent.middleware());
 app.use('/graphql', apolloExpress((req) => {
   // Get the query, the same way express-graphql does it
   // https://github.com/graphql/express-graphql/blob/3fa6e68582d6d933d37fa9e841da5d2aa39261cd/src/index.js#L257
@@ -70,6 +76,7 @@ app.use('/graphql', apolloExpress((req) => {
       Users: new Users({ connector: gitHubConnector }),
       Entries: new Entries(),
       Comments: new Comments(),
+      opticsContext: agent.context(req),
     },
   };
 }));
diff --git a/package.json b/package.json
index 5c96682..3ad1d8c 100644
--- a/package.json
+++ b/package.json
@@ -52,6 +52,7 @@
     "graphql-tools": "^0.7.0",
     "knex": "^0.11.3",
     "lodash": "^4.12.0",
+    "optics-agent": "^0.0.15",
     "passport": "^0.3.2",
     "passport-github": "^1.1.0",
     "request-promise": "^3.0.0",
```
