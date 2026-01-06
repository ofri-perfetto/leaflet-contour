/* eslint-disable */

var shared, worker, mlcontour;
// define gets called three times: one for each chunk. we rely on the order
// they're imported to know which is which
function define(_, chunk) {
  if (!shared) {
    shared = chunk;
  } else if (!worker) {
    worker = chunk;
  } else {
    var workerBundleString =
      "var sharedChunk = {}; (" +
      shared +
      ")(sharedChunk); (" +
      worker +
      ")(sharedChunk);";

    var sharedChunk = {};
    shared(sharedChunk);
    mlcontour = {};
    chunk(mlcontour, sharedChunk);
    if (typeof window !== "undefined") {
      mlcontour.workerUrl = window.URL.createObjectURL(
        new Blob([workerBundleString], { type: "text/javascript" })
      );
      // Expose exports directly on window for convenience
      Object.keys(mlcontour).forEach(function(key) {
        window[key] = mlcontour[key];
      });
    }
  }
}
