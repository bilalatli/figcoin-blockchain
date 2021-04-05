import * as fs from 'fs';

function getDirectories(path: string) {
  return fs.readdirSync(path).filter((file) => {
    return fs.statSync(`${path}/${file}`).isDirectory();
  });
}

function getFiles(path: string) {
  return fs.readdirSync(path).filter((file) => {
    return fs.statSync(`${path}/${file}`).isFile();
  });
}

const FSUtil = {
  getDirectories,
  getFiles
};
export default FSUtil;
