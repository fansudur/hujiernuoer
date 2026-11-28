// Run from a release checkout with Node.js, after:
// npm install --no-save --no-package-lock --ignore-scripts esbuild@0.25.12
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = resolve(root, 'app-main-inflow');
const cssFiles = [
  'styles.css', 'v74-panels.css', 'v76-guide-layout.css', 'v83-reference.css',
  'v89-space.css', 'v93-chapter1.css', 'guide-review.css', 'v74-director.css',
  'mobile-atlas.css', 'redesign-minimal-2026.css', 'guide-seek.css', 'atlas-i18n.css',
];
const entryFiles = ['app.js', 'v93-chapter1.js', 'redesign-motion.js'];
const stylesheet = 'atlas-ui.min.css';
const script = 'atlas-entry.min.js';
const languageModule = (await readFile(resolve(app,'atlas-i18n.js'),'utf8'))
  .match(/['"](\.\/atlas-en\.js(?:\?[^'"]*)?)['"]/)?.[1];
if (!languageModule) throw new Error('Review the English module split before regenerating');
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const [css, js] = await Promise.all([
  Promise.all(cssFiles.map(file => readFile(resolve(app,file),'utf8'))).then(async files => {
    const rows = files.map(file => file.replace(/^\uFEFF|^@charset\s+['"][^'"]+['"];\s*/gim, ''));
    if (rows.some(file => /^\s*@import\b/m.test(file))) throw new Error('Review relative CSS @import before merging');
    return (await transform(rows.join('\n'), {loader:'css',minify:true,charset:'utf8'})).code;
  }),
  build({
    stdin: {contents:entryFiles.map(file => 'import "./' + file + '";').join('\n'),resolveDir:app},
    outfile:resolve(app,script), bundle:true, write:false, minify:true, charset:'utf8',
    platform:'browser',format:'esm',target:'es2022',
    // Keep the large translation table independent for cache reuse and size budget.
    external:[languageModule], logLevel:'warning',
  }).then(result => result.outputFiles[0].contents)
]);
await Promise.all([writeFile(resolve(app,stylesheet),css), writeFile(resolve(app,script),js)]);
const source = await readFile(resolve(app,'index.html'),'utf8');
let html = source.replace(/^\s*<link rel="modulepreload" data-atlas-release href="[^"]*">[ \t]*\r?\n/gm,'');
const cssTag = '<link rel="stylesheet" href="' + stylesheet + '?rev=' + hash(css) + '">';
const scriptTag = '<script type="module" src="' + script + '?rev=' + hash(js) + '"></script>';
let cssCount=0, scriptCount=0;
html = html.replace(/^([ \t]*)<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">[ \t]*\r?\n/gm,(line,space,file)=>{
  if (!cssFiles.includes(file) && file!==stylesheet) return line;
  const preload = path => space+'<link rel="modulepreload" data-atlas-release href="'+path+'">\n';
  return cssCount++===0 ? space+cssTag+'\n' + preload(script+'?rev='+hash(js)) : '';
});
html = html.replace(/^([ \t]*)<script type="module" src="([^"?]+)(?:\?[^"]*)?"><\/script>[ \t]*\r?\n/gm,(line,space,file)=>{
  if (!entryFiles.includes(file) && file!==script) return line;
  return scriptCount++===0 ? space+scriptTag+'\n' : '';
});
if (![1,cssFiles.length].includes(cssCount)||![1,entryFiles.length].includes(scriptCount)) {
  throw new Error('Unexpected atlas entry tags; do not silently alter order');
}
await Promise.all([
  writeFile(resolve(app,'index.html'),html),
  writeFile(resolve(root,'index.html'),html.replace('<head>', '<head>\n  <!-- Root shell: generated from app-main-inflow/index.html. -->\n  <base href="./app-main-inflow/">')),
]);
console.log(stylesheet,hash(css),Buffer.byteLength(css),'bytes; ',script,hash(js),js.byteLength,'bytes');
