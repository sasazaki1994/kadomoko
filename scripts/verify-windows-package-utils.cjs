const assert = require('node:assert/strict');

function normalizeArchivePath(filePath) {
  return `/${filePath.replaceAll('\\\\', '/').replaceAll('\\', '/').replace(/^\/+/, '')}`;
}

function assertAsarContents(entries) {
  const normalized = entries.map(normalizeArchivePath);
  assert.ok(
    normalized.some((entry) => /^\/dist\/assets\/kadomoco_sheet-.*\.png$/.test(entry)),
    `app.asar must include the sprite sheet asset; found ${normalized.length} entries`,
  );
  for (const forbiddenPath of ['/src/', '/test/', '/e2e/', '/spec/', '/scripts/']) {
    const found = normalized.find((entry) => entry === forbiddenPath.slice(0, -1) || entry.startsWith(forbiddenPath));
    assert.equal(found, undefined, `app.asar must not include ${forbiddenPath}; found ${found}`);
  }
}

module.exports = { assertAsarContents, normalizeArchivePath };
