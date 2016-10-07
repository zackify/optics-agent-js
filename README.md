# optics-agent-js
Optics Agent for GraphQL-js

Here are the steps to enable Optics Agent in your app. See below for details on each step:
* Install the NPM package in your app: `npm install optics-agent --save`
* Import the package in your main js file: `import OpticsAgent from 'optics-agent';`
* [optional] Configure the agent: `OpticsAgent.configureAgent({ options });`
* Instrument your app. In any order:
 * Instrument your schema: `OpticsAgent.instrumentSchema(executableSchema);`
 * Add the middleware: `expressServer.use(OpticsAgent.middleware());`
 * Add to your GraphQL context object: `context.opticsContext = OpticsAgent.context(req);`

## Install

First, install the package

```
npm install optics-agent --save
```

## Configure

Next, setup the agent in your main server file.

### Import the package

```
var OpticsAgent = require('optics-agent');
```

or in ES2015+

```
import OpticsAgent from 'optics-agent';
```

### [optional] Configure the Agent

```
OpticsAgent.configureAgent({ configOptions })
```

Normally you do not need to call this function -- just set the `OPTICS_API_KEY` environment variable. Call this function if you set the API key in code instead of through the environment variable, or if you need to set specific non-default value for options. Call this _before_ any calls to instrumentation functions below.

Options include:

* `apiKey`: String. Your API key for the Optics service. This defaults to the `OPTICS_API_KEY` environtment variable, but can be overriden here.

* `reportTraces`: Boolean: Send detailed traces along with usage reports. Defaults to true.

* `reportVariables`: Boolean: Send the query variables along with traces. Defaults to true.

* `normalizeVersion`: Function(req)->[String,String]. Called to determine the client platform and version for a request. You may want to override this to improve client detection, eg, if you have a custom user-agent for a mobile client.

* `normalizeQuery`: Function(info)->String. Called to determine the query shape for for a GraphQL query. You shouldn't need to set this unless you are debugging.

* `debugFn`: Function(args). Called to print debugging messages. Defaults to `console.log`. To silence optics if `console.log` is not OK in your environment, pass `debugFn: () => {}`.

* `endpointUrl`: String. Where to send the reports. Defaults to the production Optics endpoint, or `OPTICS_ENDPOINT_URL` if it is set. You shouldn't need to set this unless you are debugging.

* `reportIntervalMs`: Int. How often to send reports in milliseconds. Defaults to 1 minute. You shouldn't need to set this unless you are debugging.

* `printReports`: Boolean: Print reports as the are sent. This may be useful for debugging. Defaults to false.


### Instrument your schema

Call `instrumentSchema` on the same executable schema object you pass to `graphql-js` to run.

```
OpticsAgent.instrumentSchema(executableSchema);
```

You should only call this once per agent. If you have multiple or dynamic schemas, create a separate agent per schema (see below).

### Add the middleware

Setup middleware:

#### Express
```
expressServer.use(OpticsAgent.middleware());
```
Do this right before your GraphQL server for best results.

#### HAPI
```
OpticsAgent.instrumentHapiServer(hapiServer);
```


### Add a context to each graphql request

In the `context` object sent to graphql, add a new field:
```
{ opticsContext: OpticsAgent.context(req) }
```

If you are using HAPI you must explicitly use the raw request object:
```
{ opticsContext: OpticsAgent.context(request.raw.req) }
```

### Example

Here's an example diff:

https://github.com/apollostack/GitHunt-API/compare/nim/optics-agent

```diff
diff --git a/api/index.js b/api/index.js
index 43ee586..2eb1845 100644
--- a/api/index.js
+++ b/api/index.js
@@ -19,6 +19,10 @@ import { subscriptionManager } from './subscriptions';

 import schema from './schema';

+import OpticsAgent from 'optics-agent';
+OpticsAgent.instrumentSchema(schema);
+
+
 let PORT = 3010;
 if (process.env.PORT) {
   PORT = parseInt(process.env.PORT, 10) + 100;
@@ -33,6 +37,7 @@ app.use(bodyParser.json());

 setUpGitHubLogin(app);

+app.use('/graphql', OpticsAgent.middleware());
 app.use('/graphql', apolloExpress((req) => {
   // Get the query, the same way express-graphql does it
   // https://github.com/graphql/express-graphql/blob/3fa6e68582d6d933d37fa9e841da5d2aa39261cd/src/index.js#L257
@@ -70,6 +75,7 @@ app.use('/graphql', apolloExpress((req) => {
       Users: new Users({ connector: gitHubConnector }),
       Entries: new Entries(),
       Comments: new Comments(),
+      opticsContext: OpticsAgent.context(req),
     },
   };
 }));
diff --git a/package.json b/package.json
index 5c96682..6223cfa 100644
--- a/package.json
+++ b/package.json
@@ -52,6 +52,7 @@
     "graphql-tools": "^0.7.0",
     "knex": "^0.11.3",
     "lodash": "^4.12.0",
+    "optics-agent": "^0.0.26",
     "passport": "^0.3.2",
     "passport-github": "^1.1.0",
     "request-promise": "^3.0.0",
```

## Advanced Usage

If you need to have more than one Agent per process, you can manually construct an Agent object instead of using the default global Agent. Call `new OpticsAgent.Agent(options)` to instantiate the object, and then call methods directly on the object instead of on `OpticsAgent`. Here is an example:

```
var OpticsAgent = require('optics-agent');
var agent = new OpticsAgent.Agent({ apiKey: '1234' });
agent.instrumentSchema(schema);
...

```
