'use strict';
const logger = require('lambda-log');
// const env = process.env.NODE_ENV || 'development';
// process.env.LOG_LEVEL = 'info';
// Unused..tag with this?

function get_filename(filename) {
    return filename.split('/').slice(-2).join('/');

    // var filename = module.id;
    // return path.basename(module.parent.filename);
}

module.exports = function makeLogger(filename) {
    if(process.env.NODE_ENV === 'test'){
        logger.options.silent = true;
    }
    logger.options.debug = true;
    return logger;
}
