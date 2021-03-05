const fs = require('fs')
const readline = require("readline");

let credentials_dir = __dirname + '/credentials_data'
if (!fs.existsSync(credentials_dir)) fs.mkdirSync(credentials_dir)

function credentials_path(name) {
    return credentials_dir + '/' + name + '.json'
}

function get_credentials(name) {
    let path = credentials_path(name)
    if (!fs.existsSync(path)) return null
    return JSON.parse(fs.readFileSync(path))
}

function set_credentials(name, credentials) {
    let path = credentials_path(name)
    fs.writeFileSync(path, JSON.stringify(credentials))
    return true
}

async function ask_credentials(displayed_text) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((ok, err) => {
        rl.question("CREDENTIAL NEEDED - " + displayed_text + ": ", function (data) {
            ok(data)
            rl.close();
        });
    })
}

module.exports = { get_credentials, set_credentials, ask_credentials }