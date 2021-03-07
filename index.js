// -------------------------------------------------------- REQUIRES

const fs = require('fs')
const CONNECTOR = require('./connector')
const log = require('./logger')

// -------------------------------------------------------- DATA

const connectors = Object.freeze(JSON.parse(fs.readFileSync('./connectors.json')))

// -------------------------------------------------------- METHODS

async function launch_connector(name, config) {
    let conn = new CONNECTOR(name, config)
    await conn.launch()
}

// -------------------------------------------------------- MAIN

async function main() {
    log('SYSTEM', 'launch of ZRMc system v' + JSON.parse(fs.readFileSync('./package.json')).version)
    for (let conn_name in connectors) await launch_connector(conn_name, connectors[conn_name])
}
main()