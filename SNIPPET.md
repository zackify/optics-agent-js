Install via npm
```
$ npm install --save optics-agent
```
Instrument your GraphQL Server
```js
import OpticsAgent from 'optics-agent';
const agent = new OpticsAgent({ apiKey: '...' });
agent.instrumentSchema(executableSchema);
expressServer.use(agent.middleware());
context.opticsContext = agent.context(req);
```
[Read more: optics-agent-js on GitHub](https://github.com/apollostack/optics-agent-js)
