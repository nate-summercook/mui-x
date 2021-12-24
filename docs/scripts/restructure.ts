import fs from 'fs';
import path from 'path';
import prettier from 'prettier';

const workspaceRoot = path.resolve(__dirname, '../../');
const prettierConfigPath = path.join(workspaceRoot, 'prettier.config.js');

function writePrettifiedFile(filename: string, data: string, options: object = {}) {
  const prettierConfig = prettier.resolveConfig.sync(filename, {
    config: prettierConfigPath,
  });
  if (prettierConfig === null) {
    throw new Error(
      `Could not resolve config for '${filename}' using prettier config path '${prettierConfigPath}'.`,
    );
  }

  fs.writeFileSync(filename, prettier.format(data, { ...prettierConfig, filepath: filename }), {
    encoding: 'utf8',
    ...options,
  });
}

const appendSource = (target: string, template: string, source: string) => {
  const match = source.match(/^(.*)$/m);
  if (match && target.includes(match[0])) {
    // do nothing if $source already existed
    return target;
  }
  // eslint-disable-next-line prefer-template
  return target.replace(new RegExp(template), template + '\n' + source);
};

const updateAppToUseProductPagesData = () => {
  const appPath = path.resolve(__dirname, '../../docs/pages/_app.js');
  let appSource = fs.readFileSync(appPath, { encoding: 'utf8' });
  appSource = appendSource(
    appSource,
    `import pages from 'docs/src/pages';`,
    `import dataGridPages from 'docs/data/data-grid/pages';`,
  );
  appSource = appendSource(
    appSource,
    `let productPages = pages;`,
    `if (router.asPath.startsWith('/x/data-grid')) {
      productPages = dataGridPages;
    }`,
  );
  writePrettifiedFile(appPath, appSource);
};

const readdirDeep = (directory: string, pathsProp: string[] = []) => {
  const paths: string[] = pathsProp;
  const items = fs.readdirSync(directory);
  items.forEach((item) => {
    const itemPath = path.resolve(directory, item);

    if (fs.statSync(itemPath).isDirectory()) {
      readdirDeep(itemPath, paths);
    }

    paths.push(itemPath);
  });

  return paths;
};

function run() {
  /**
   * clone pages & api data from `docs/src/pages.ts` to `docs/src/data/materialPages.ts`
   * also prefix all pathnames with `/$product/` by using Regexp replace
   */

  // update _app.js to use product pages
  updateAppToUseProductPagesData();

  // clone js/md data to new location
  const dataDir = readdirDeep(path.resolve(`docs/src/pages/components/data-grid`));
  dataDir.forEach((filePath) => {
    const match = filePath.match(/^(.*)\/[^/]+\.(ts|js|tsx|md|json)$/);
    const info = match
      ? {
          directory: match[1].replace('src/pages/components', 'data'),
          path: filePath.replace('src/pages/components', 'data'),
        }
      : null;
    // pathname could be a directory
    if (info) {
      let data = fs.readFileSync(filePath, { encoding: 'utf-8' });
      if (filePath.endsWith('.md')) {
        // remove relative path, so that the demos does not rely on a specific path
        // before: {{"demo": "pages/components/data-grid/accessibility/DensitySelectorSmallGrid.js", "bg": "inline"}}
        // after: {{"demo": "DensitySelectorSmallGrid.js", "bg": "inline"}}
        data = data.replace(/"pages\/[/\-a-zA-Z]*\/([a-zA-Z]*\.js)"/gm, `"$1"`);
      }
      fs.mkdirSync(info.directory, { recursive: true });
      fs.writeFileSync(info.path, data); // (A)

      fs.rmSync(filePath);
    }
  });

  const pagesDir = readdirDeep(path.resolve(`docs/pages/components/data-grid`));
  pagesDir.forEach((filePath) => {
    const match = filePath.match(/^(.*)\/[^/]+\.(ts|js|tsx|md|json)$/);
    const info = match
      ? {
          directory: match[1].replace('components/data-grid', 'x/react-data-grid'),
          path: filePath.replace('components/data-grid', 'x/react-data-grid'),
        }
      : null;

    if (info) {
      let data = fs.readFileSync(filePath, { encoding: 'utf-8' });

      if (filePath.endsWith('.js')) {
        data = data.replace('src/pages/components', `data`); // point to data path (A) in new directory
      }

      fs.mkdirSync(info.directory, { recursive: true });
      fs.writeFileSync(info.path, data);

      fs.writeFileSync(filePath, data);
    }
  });
}

run();