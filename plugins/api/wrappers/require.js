const fsWrapper = require('./fs.js');

module.exports = function(name)
{
    if (name.toLowerCase() === 'fs')
        return fsWrapper;

    try {
        return require(name);
    } catch(e) {
        return require(Path.join(process.cwd(), 'node_modules', name));
    }
};