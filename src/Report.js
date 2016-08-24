export const reportRequest = (req) => {
  const context = req._opticsContext;
  console.log("WWW", context);
};
