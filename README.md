# optics-agent-js
Optics Agent for GraphQL-js

Here are the steps to enable Optics Agent in your app. See below for details on each step:
* Install the NPM package in your app: `npm install optics-agent --save`
* Import the package in your main js file: `import OpticsAgent from 'optics-agent';`
* Get an API key from the Optics web interface and configure the agent. Either:
 * Set the `OPTICS_API_KEY` environment variable to your API key
 * Set the API key and more with `OpticsAgent.configureAgent({ options });`
* Instrument your app. In any order:
 * Instrument your schema: `OpticsAgent.instrumentSchema(executableSchema);`
 * Add the middleware: `expressServer.use(OpticsAgent.middleware());`
 * Add to your GraphQL context object: `context.opticsContext = OpticsAgent.context(req);`

## Version requirements

Optics Agent supports:

* Node: 4, 5 and 6
* [graphql](https://www.npmjs.com/package/graphql): 0.6 and 0.7

## Install

First, install the package

```
npm install optics-agent --save
```

## Configure

Next, set up the agent in your main server file.

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

Normally you do not need to call this function -- just set the `OPTICS_API_KEY` environment variable. Call this function if you set the API key in code instead of through the environment variable, or if you need to set specific non-default values for other options. Call this _before_ any calls to instrumentation functions below.

Options include:

* `apiKey`: String. Your API key for the Optics service. This defaults to the `OPTICS_API_KEY` environment variable, but can be overridden here.

* `reportTraces`: Boolean. Send detailed traces along with usage reports. Defaults to true.

* `reportVariables`: Boolean. Send the query variables along with traces. Defaults to true.

* `printReports`: Boolean. Print a JSON version of reports as they are sent. This may be useful for debugging. Defaults to false.

* `normalizeQuery`: Function([GraphQLResolveInfo](http://graphql.org/graphql-js/type/#graphqlobjecttype))⇒String. Called to determine the query shape for for a GraphQL query. You shouldn't need to set this unless you are debugging.

* `endpointUrl`: String. Where to send the reports. Defaults to the production Optics endpoint, or the `OPTICS_ENDPOINT_URL` environment variable if it is set. You shouldn't need to set this unless you are debugging.

* `reportIntervalMs`: Number. How often to send reports in milliseconds. Defaults to 1 minute. You shouldn't need to set this unless you are debugging.


### Instrument your schema

Call `instrumentSchema` on the same [executable schema object](http://graphql.org/graphql-js/type/#graphqlschema) you pass to the [`graphql` function from `graphql-js`](http://graphql.org/graphql-js/graphql/#graphql):

```
OpticsAgent.instrumentSchema(executableSchema);
```

You should only call this once per agent. If you have multiple or dynamic schemas, create a separate agent per schema (see below).

### Add the middleware

Set up middleware:

#### Express

Tell your server to run the Optics Agent middleware:

```
expressServer.use(OpticsAgent.middleware());
```

This must run before the handler that actually executes your GraphQL queries.  For the most accurate timings, avoid inserting unnecessary middleware between the Optics Agent middleware and your GraphQL middleware.

#### HAPI
```
OpticsAgent.instrumentHapiServer(hapiServer);
```


### Add a context to each graphql request

Inside your request handler, if you are calling `graphql` directly, add a new
field to the `context` object sent to `graphql`:

```
{ opticsContext: OpticsAgent.context(req) }
```

If you are using `apolloExpress`, this will be a field on
the
[`context` object on the `ApolloOptions` value that you return](http://dev.apollodata.com/tools/apollo-server/setup.html#options-function).

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
index 98df047..b110fac 100644
--- a/package.json
+++ b/package.json
@@ -52,6 +52,7 @@
     "graphql-tools": "0.7.2",
     "knex": "0.12.3",
     "lodash": "4.16.4",
+    "optics-agent": "0.0.33",
     "passport": "0.3.2",
     "passport-github": "1.1.0",
     "request-promise": "4.1.1",
```

## Advanced Usage

If you need to have more than one Agent per process, you can manually construct an Agent object instead of using the default global Agent. Call `new OpticsAgent.Agent(options)` to instantiate the object, and then call methods directly on the object instead of on `OpticsAgent`. Here is an example:

```
var OpticsAgent = require('optics-agent');
var agent = new OpticsAgent.Agent({ apiKey: '1234' });
agent.instrumentSchema(schema);
```
