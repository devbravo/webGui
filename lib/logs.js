/*
 * Library for storing and rotating logs
 */

// Dependencies
const { open, appendFile, readdir, readFile, writeFile, truncate } = require('fs/promises');
const path = require('path');
const zlib = require('zlib');

// open => <promise> fulfills <FileHandle> object
// appendFile => <promise> fulfills with <undefined>
// readdir => <Promise> fulfills with []
// readFile => <Promise> fulfills with contents of file
// writeFile => <Promise> fulfills with undefined
// truncate => <Promise> fulfills with undefined

// Container for the module
const lib = {};

// Base directroy of the logs folder
lib.baseDir = path.join(__dirname, '/../.logs/');

// Append a string to a file. Create the file if it does not exist
lib.append = async (file, str) => {
  // Opening the file for appending
  const fileDir = lib.baseDir + file + '.log';
  let fileHandle;
  fileHandle = await open(fileDir, 'a');

  if (fileHandle) {
    // Append to the file and close it
    const fileAppend = await appendFile(fileHandle, str + '\n');
    if (typeof fileAppend == 'undefined') {
      await fileHandle?.close();
    } else {
      console.error('Error appending to file');
    }
  } else {
    console.error('Could not open file for appending');
  }
};

// List all the logs, and optionally include the compressed logs
lib.list = async includeCompressedLogs => {
  const data = await readdir(lib.baseDir);
  if (data && data.length > 0) {
    const trimmedFileNames = [];
    data.forEach(fileName => {
      // Add the .log files
      if (fileName.indexOf('.log') > -1) {
        trimmedFileNames.push(fileName.replace('.log', ''));
      }
      // Add on the .gz files
      if (fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
        trimmedFileNames.push(fileName.replace('.gz.b64'), '');
      }
    });
    return false, trimmedFileNames;
  } else {
    console.error(data);
  }
};

// Compress the contents of one .log file into a .gz.b64 file within the same directory
lib.compress = async (logId, newFileId) => {
  const soureceFile = logId + '.log';
  const destFile = newFileId + '.gz.b64';
  const fileDir = lib.baseDir + destFile;
  let fileHandle;

  // Read the source file
  try {
    const inputString = await readFile(lib.baseDir + soureceFile, 'utf8');

    // Compress the data using gzip
    zlib.gzip(inputString, async (err, buffer) => {
      if (!err && buffer) {
        // Send the data to the destination file
        fileHandle = await open(fileDir, 'wx');
        // Write to the destination file
        const data = await writeFile(fileDir, buffer.toString('base64'));
        if (typeof data == 'undefined') {
          // Close the destination file
          await fileHandle?.close();
        } else {
          console.log('Error: writing to file');
        }
      } else {
        console.log(err);
      }
    });
  } catch (err) {
    console.log(err);
  }
};

// Decompress the contents of a .gz.b64 file into a string variable
lib.decompress = async fileId => {
  const fileName = fileId + '.gz.b64';
  const str = await readFile(lib.baseDir + fileName, 'utf8');
  if (str) {
    // Decompress the data
    const inputBuffer = Buffer.from(str, 'base64');
    const outputBuffer = zlib.unzip(inputBuffer);
    if (outputBuffer) {
      // Callback
      const str = outputBuffer.toString();
      console.error(false, str);
    } else {
      console.error(err);
    }
  } else {
    console.error(err);
  }
};

// Truncating a log file
lib.truncate = async logId => {
  const fileDir = lib.baseDir + logId + '.log';
  try {
    await truncate(fileDir, 0);
  } catch (err) {
    console.error(err);
  }
};

// Export the module
module.exports = lib;
