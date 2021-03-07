const log = require('log-to-file');
const util = require('util')

module.exports = function () {
    let args = Array.from(arguments)
    let name = args.shift()
    let str = '[' + name + ']::' + args.map(arg => util.format(arg)).join(' ')
    if (!process.env.SILENT) console.log(str)
    log(str, 'logs.log');
}