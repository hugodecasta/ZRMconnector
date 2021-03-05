// -------------------------------------------------------- REQUIRES

const fs = require('fs')
const CONNECTOR = require('./connector')

// -------------------------------------------------------- DATA

const connectors = Object.freeze(JSON.parse(fs.readFileSync('./connectors.json')))

// -------------------------------------------------------- METHODS

async function launch_connector(name, config) {
    let conn = new CONNECTOR(name, config)
    await conn.launch()
}

// -------------------------------------------------------- MAIN

async function main() {
    Object.entries(connectors).map(([name, config]) => launch_connector(name, config))
}
main()