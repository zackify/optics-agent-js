```js
const OpticsAgent = require('optics-agent');
const agent = new OpticsAgent({
  apiKey: '...' // can also set OPTICS_API_KEY environment variable instead
});
agent.instrumentSchema(executableSchema);
expressServer.use(agent.middleware());
context.opticsContext = agent.context(req);
```
[Read more: optics-agent-js on GitHub](https://github.com/apollostack/optics-agent-js)
