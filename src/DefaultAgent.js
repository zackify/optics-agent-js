// This file contains the global state for default Agent object. Most
// users will only want one agent, and it can be convienient not to
// have to share an Agent instance between the various instrumentation
// call sites.

import Agent from './Agent';


let defaultAgent = null;

// This is used to pass options to the default Agent. Call it at most
// once before any other calls.
export const configureAgent = (options) => {
  if (defaultAgent) {
    throw new Error(
      'Optics Agent configuration already set. Make sure `configureAgent` is called only once, and before any calls to `middleware` or `instrumentSchema`.'
    );
  }

  defaultAgent = new Agent(options);

  return;
};

export const instrumentSchema = (schema) => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.instrumentSchema(schema);
};

export const middleware = () => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.middleware();
};

export const instrumentHapiServer = (server) => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.instrumentHapiServer(server);
};

export const context = (req) => {
  if (!defaultAgent) { defaultAgent = new Agent(); }
  return defaultAgent.context(req);
};
