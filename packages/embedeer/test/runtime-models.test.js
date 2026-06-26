import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getLoadedModels, registerLoadedModel, unregisterLoadedModel } from '../src/index.js'

test('runtime models registry tracks loaded models', () => {
  // Test the runtime registry functions directly
  // This is a unit test that doesn't require model initialization
  const modelName = 'test-runtime-model-abc'

  // Start clean
  const before = getLoadedModels()
  assert.ok(!before.includes(modelName), 'Model should not be loaded initially')

  // Register the model
  registerLoadedModel(modelName)
  let loaded = getLoadedModels()
  assert.ok(loaded.includes(modelName), 'Model should be registered after call')

  // Unregister the model
  unregisterLoadedModel(modelName)
  loaded = getLoadedModels()
  assert.ok(!loaded.includes(modelName), 'Model should be unregistered after call')
})
