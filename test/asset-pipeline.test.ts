import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = process.cwd();
const validator = join(root, 'scripts/validate-sprite-sheet.mjs');
const prepare = join(root, 'scripts/prepare-production-sprite-sheet.mjs');
const icons = join(root, 'scripts/generate-app-icons.mjs');
const source = join(root, 'assets/source/kadomoco-generated-magenta.png.base64');
const spec = join(root, 'src/game/spriteSheetSpec.json');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'kadomoco-valid-sprite-'));
const validFixture = join(fixtureRoot, 'sheet.png');
mkdirSync(join(fixtureRoot, 'artifacts'));
execFileSync(process.execPath, [prepare], { cwd: root, env: { ...process.env, SPRITE_SHEET_PATH: validFixture, SPRITE_ARTIFACT_DIR: join(fixtureRoot, 'artifacts'), SPRITE_SPEC_PATH: spec, SPRITE_SOURCE_BASE64_PATH: source }, stdio: 'ignore' });

function workspace() { const dir=mkdtempSync(join(tmpdir(),'kadomoco-assets-')); mkdirSync(join(dir,'artifacts')); return dir; }
function validate(sheet:string) { return spawnSync(process.execPath,[validator],{cwd:root,env:{...process.env,SPRITE_SHEET_PATH:sheet,SPRITE_SPEC_PATH:spec},encoding:'utf8'}); }
function expectInvalid(name:string,data:Buffer|string) { const dir=workspace(), path=join(dir,`${name}.png`); writeFileSync(path,data); const result=validate(path); assert.notEqual(result.status,0,`${name} unexpectedly passed`); assert.match(result.stderr,/Sprite validation failed/); }

 test('a valid PNG and a canonically regenerated PNG pass validation',()=>{
  assert.equal(validate(validFixture).status,0);
  const dir=workspace(), sheet=join(dir,'sheet.png');
  execFileSync(process.execPath,[prepare],{cwd:root,env:{...process.env,SPRITE_SHEET_PATH:sheet,SPRITE_ARTIFACT_DIR:join(dir,'artifacts'),SPRITE_SPEC_PATH:spec,SPRITE_SOURCE_BASE64_PATH:source}});
  assert.equal(validate(sheet).status,0);
  assert.deepEqual(readFileSync(sheet),readFileSync(validFixture));
});

test('rejects an invalid signature, empty file, UTF-8 pseudo-PNG, and literal Base64',()=>{
  expectInvalid('signature',Buffer.from('not a png'));
  expectInvalid('empty',Buffer.alloc(0));
  expectInvalid('utf8',Buffer.from('\uFFFDPNG\r\ntext','utf8'));
  expectInvalid('base64',readFileSync(source,'utf8'));
});

test('rejects truncated and otherwise undecodable PNG data',()=>{
  const png=readFileSync(validFixture);
  expectInvalid('truncated',png.subarray(0,Math.floor(png.length/2)));
  const corrupt=Buffer.from(png); corrupt[Math.floor(corrupt.length/2)]^=0xff;
  expectInvalid('corrupt',corrupt);
});

test('rejects a decodable PNG whose dimensions differ from the sprite spec',()=>{
  const dir=workspace(), path=join(dir,'wrong-size.png');
  execFileSync(process.execPath,['--input-type=module','-e',`import {writePngRgba} from ${JSON.stringify(pathToFileURL(join(root,'scripts/png-rgba.mjs')).href)}; writePngRgba(${JSON.stringify(path)},1,1,Buffer.alloc(4));`]);
  const result=validate(path); assert.notEqual(result.status,0); assert.match(result.stderr,/must be 256x512px/);
});

test('generate:icons keeps preparation and validation ahead of raw generation',()=>{
  const scripts=(JSON.parse(readFileSync(join(root,'package.json'),'utf8')) as {scripts:Record<string,string>}).scripts;
  assert.equal(scripts['generate:icons'],'npm run prepare:sheet && npm run validate:sprite:check && npm run generate:icons:raw');
});

test('a damaged sprite is restored from the canonical source before icons are generated',()=>{
  const dir=workspace(), sheet=join(dir,'sheet.png'), out=join(dir,'icons'); writeFileSync(sheet,'damaged');
  const env={...process.env,SPRITE_SHEET_PATH:sheet,SPRITE_ARTIFACT_DIR:join(dir,'artifacts'),SPRITE_SPEC_PATH:spec,SPRITE_SOURCE_BASE64_PATH:source,ICON_OUTPUT_DIR:out};
  execFileSync(process.execPath,[prepare],{cwd:root,env});
  execFileSync(process.execPath,[icons],{cwd:root,env});
  assert.equal(validate(sheet).status,0); assert.ok(readFileSync(join(out,'icon.ico')).length>0);
});

test('a damaged canonical source fails instead of falling back to an existing sprite',()=>{
  const dir=workspace(), sheet=join(dir,'sheet.png'), badSource=join(dir,'bad.base64'); copyFileSync(validFixture,sheet); writeFileSync(badSource,'not base64 PNG');
  const result=spawnSync(process.execPath,[prepare],{cwd:root,env:{...process.env,SPRITE_SHEET_PATH:sheet,SPRITE_ARTIFACT_DIR:join(dir,'artifacts'),SPRITE_SPEC_PATH:spec,SPRITE_SOURCE_BASE64_PATH:badSource},encoding:'utf8'});
  assert.notEqual(result.status,0); assert.equal(basename(sheet),'sheet.png'); assert.deepEqual(readFileSync(sheet),readFileSync(validFixture));
});
