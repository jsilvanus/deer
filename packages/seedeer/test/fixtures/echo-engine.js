export async function createEngine(options) {
  return {
    async run(task) {
      if (task.type === 'fail') throw new Error('intentional failure');
      return { echoedOptions: options, task };
    },
    async dispose() {},
  };
}
