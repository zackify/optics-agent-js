# optics-agent-js
Optics Agent for GraphQL-js

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
app.use(agent.middleware());
```
Do this right before your GraphQL server for best results.

#### HAPI
```
agent.registerHapiExtensions(server)
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

