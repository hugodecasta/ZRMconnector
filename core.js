// -------------------------------------------------------- REQUIRES

const fs = require('fs')

// -------------------------------------------------------- DATA

const connectors = Object.freeze(JSON.parse(fs.readFileSync('./connectors.json')))

// -------------------------------------------------------- METHODS

async function launch_connector(name, config) {
    config.name = name
}

// -------------------------------------------------------- MAIN

async function main() {
    Object.entries(connectors).map(([name, config]) => launch_connector(name, config))
}
main()