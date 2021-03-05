const ZAPI = require('./zotero_api')
const RMAPI = require('./remarkable_api')

class CONNECTOR {

    // ----------------------------------------- CONSTRUCTION
    constructor(name, config) {

        let { remarkable_dir, remarkable_archive_dir, zotero_path, tags } = config
        this.remarkable_dir = remarkable_dir
        this.remarkable_archive_dir = remarkable_archive_dir
        this.zotero_path = zotero_path
        this.tags = tags

        this.used_tags = Object.keys(this.tags)
        this.used_dirs = Object.values(this.tags)

        this.zapi = new ZAPI()
        this.rmapi = new RMAPI()
    }

    // ----------------------------------------- UTILS

    clone(obj) {
        return JSON.parse(JSON.stringify(obj))
    }

    state_diff(from_state, to_state) {
        let all_titles = Object.values(from_state).concat(Object.values(to_state)).flat()
            .filter((e, i, s) => s.indexOf(e) == i)
        return all_titles
            .map(title => ({
                title,
                'from': this.used_tags.filter(tag => from_state[tag].includes(title))[0],
                'to': this.used_tags.filter(tag => to_state[tag].includes(title))[0],
            }))
            .filter(({ from, to }) => from != to)
            .map(({ title, from, to }) => ({ title, action: from ? to ? 'move' : 'remove' : 'add', from, to }))
    }

    // ----------------------------------------- CHECKER
    async checker() {

    }

    // ----------------------------------------- LAUNCHER
    async launch() {

        // ---- setup remarkable
        await Promise.all(this.used_dirs.map(dir_name => this.rmapi.mkdir(this.remarkable_dir, dir_name)))

        // ---- setup zotero api
        for (let { type, name } of this.zotero_path) {
            if (type == 'group') await this.zapi.goto_group(name)
            else if (type == 'collection') await this.zapi.goto_collection(name)
        }

        // ---- setup interval

    }
}

module.exports = CONNECTOR

/*
"remarkable_dir": "/AIbstract/Articles",
"remarkable_archive_dir": "trash",
"zotero_library": {
    "type": "group",
    "name": "AIbstract"
},
"tags": {
    "hugo - toread": "to read",
    "hugo - reading": "reading",
    "hugo - done": "done"
}
*/