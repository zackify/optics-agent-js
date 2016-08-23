# optics-agent-js
Optics Agent for GraphQL-js

## Install

First, install the package

```
npm install optics-agent --save
```

## Configure

Next, setup the agent in your main server file

```
var OA = require('optics-agent');
```

Configure:
```
OA.setupOptics({appKey: '1234'});
```

Setup middleware:
```
app.use(OA.opticsMiddleware);
```

In your GraphQL context:
```
{ opticsContext: OA.newContext(req) }
```

