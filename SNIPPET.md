Install via npm
```
$ npm install --save optics-agent
```
Instrument your GraphQL Server
```js
import OpticsAgent from 'optics-agent';
OpticsAgent.configureAgent({ apiKey: '...' });
OpticsAgent.instrumentSchema(executableSchema);
expressServer.use(OpticsAgent.middleware());
context.opticsContext = OpticsAgent.context(req);
```
[Read more: optics-agent-js on GitHub](https://github.com/apollostack/optics-agent-js)
