const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('プロジェクト保存は setProjectConfig で接続する', () => {
  const page = read('frontend/app/page.jsx');
  const store = read('frontend/app/store/useStore.js');
  const layout = read('frontend/app/layout.jsx');

  assert.match(page, /setProjectConfig/);
  assert.match(page, /appName:\s*['"]bbts['"]/);
  assert.match(page, /onProjectLoad/);
  assert.match(page, /showSaveModal/);
  assert.match(page, /params.*projectId|get\(['"]projectId['"]\)/);
  assert.match(store, /getProjectPayload/);
  assert.match(store, /hydrateProject/);
  assert.match(layout, /id\.data-viz-lectures\.com\/lib\/supabase\.v1\.js/);
  assert.match(layout, /id\.data-viz-lectures\.com\/lib\/dataviz-auth-client\.v1\.js/);
  assert.match(layout, /id\.data-viz-lectures\.com\/lib\/dataviz-tool-header\.v1\.js/);
  assert.doesNotMatch(layout, /app\.dataviz\.jp\/lib\//);
});
