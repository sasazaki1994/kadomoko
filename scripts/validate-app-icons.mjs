import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readPngRgba } from './png-rgba.mjs';
const required = ['build/icon.ico', 'build/tray-icon.png', 'build/icon.png'];
for (const f of required) { assert.ok(existsSync(f), `${f} must exist`); assert.ok(statSync(f).size > 0, `${f} must not be empty`); }
function validatePng(path, expected) { const png=readPngRgba(path); assert.equal(png.colorType, 6, `${path} must be RGBA`); if(expected) {assert.equal(png.width, expected); assert.equal(png.height, expected);} let transparent=0, magenta=0; for(let i=0;i<png.data.length;i+=4){ if(png.data[i+3]===0) transparent++; if(png.data[i+3] && png.data[i]>200 && png.data[i+1]<80 && png.data[i+2]>160) magenta++; } assert.ok(transparent > 0, `${path} must contain transparent pixels`); assert.equal(magenta, 0, `${path} must not contain opaque development magenta`); }
validatePng('build/tray-icon.png', 32); validatePng('build/icon.png', 256);
const ico=readFileSync('build/icon.ico'); assert.equal(ico.readUInt16LE(0),0); assert.equal(ico.readUInt16LE(2),1); const count=ico.readUInt16LE(4); const sizes=[]; for(let i=0;i<count;i++){ const off=6+i*16; const w=ico[off] || 256; const h=ico[off+1] || 256; const bytes=ico.readUInt32LE(off+8); const imgOff=ico.readUInt32LE(off+12); assert.equal(w,h); assert.ok(bytes>0); assert.ok(imgOff+bytes<=ico.length); assert.ok(ico.subarray(imgOff,imgOff+8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `ICO ${w} entry must contain PNG data electron-builder can consume`); sizes.push(w); }
assert.deepEqual(sizes.sort((a,b)=>a-b), [16,24,32,48,64,128,256]);
console.log('App icon validation passed.');
