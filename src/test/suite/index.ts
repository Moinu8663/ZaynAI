import * as path from "path";
import * as fs from "fs";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true
  });

  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    try {
      const files = getTestFiles(testsRoot);
      files.forEach(f => mocha.addFile(f));

      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getTestFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getTestFiles(filePath));
    } else if (file.endsWith(".test.js")) {
      results.push(filePath);
    }
  }
  return results;
}
