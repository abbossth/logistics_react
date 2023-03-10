const editJsonFile = require("edit-json-file");
require('dotenv').config()
var parseVersion = require('parse-version');
async function
main() {

  const path = require('path');
  const fs = require('fs').promises
  let jsInjects;
  let cssInjects;
  jsInjects = (await fs.readdir(path.join(__dirname, 'build', 'static', 'js')))
    .filter(fname => {
      return fname.split(".").slice(-1)[0] === 'js';
    })
    .map(f => 'build/static/js/' + f);
  cssInjects = (await fs.readdir(path.join(__dirname, 'build', 'static', 'css')))
    .filter(fname => {
      return fname.split(".").slice(-1)[0] === 'css';
    })
    .map(f => 'build/static/css/' + f);

  let manifestFile = editJsonFile(`${__dirname}/manifest.json`);
  manifestFile.set("content_scripts",
    [{
      matches: process.env.site.split(',').map(s => s.trim()),
      css: cssInjects,
      js: jsInjects
    }])

  const {major, minor, patch, build} = parseVersion(manifestFile.get('version'));
  manifestFile.set("version", `${major}.${minor}.${patch}.${build + 1}`)

  manifestFile.save()
}

;(async () => {
  await main()
})()
