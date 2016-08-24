// internal global state
export const _opticsConfig = {};


export const setupOptics = ({appKey}) => {
  if (_opticsConfig.appKey) {
    console.log("Error: already have an appKey. Did you run setupOptics already?");
    return;
  }
  if (!appKey) {
    console.log("Error: please provide an appKey");
    return;
  }

  _opticsConfig.appKey = appKey;
};

