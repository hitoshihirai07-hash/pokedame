import { inferCandidates } from "./engine.mjs";
self.onmessage = ({ data: { config, observations } }) => {
  try {
    const result = inferCandidates(config, observations, (value) =>
      self.postMessage({ type: "progress", value }),
    );
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
