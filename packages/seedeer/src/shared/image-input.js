/**
 * Normalizes the image input types seedeer accepts (file path, URL, Buffer,
 * or an already-decoded RawImage) into a RawImage for model input.
 *
 * @param {string|Buffer|import('@huggingface/transformers').RawImage} input
 */
export async function loadRawImage(input) {
  const { RawImage } = await import('@huggingface/transformers');

  if (Buffer.isBuffer(input)) {
    return RawImage.read(new Blob([input]));
  }
  if (typeof input === 'string' || input instanceof RawImage) {
    return RawImage.read(input);
  }
  throw new TypeError(
    'Image input must be a file path/URL (string), a Buffer, or a RawImage instance.',
  );
}
