export class NotImplementedError extends Error {
  constructor(feature, phase) {
    super(
      `${feature} is not implemented yet (planned for ${phase}). ` +
        'See docs/ROADMAP.md for the implementation phases.',
    );
    this.name = 'NotImplementedError';
  }
}
