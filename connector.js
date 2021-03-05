const ZAPI = require('./zotero_api')
const RMAPI = require('./remarkable_api')

class Connector {
    constructor(name, config) {

        let { remarkable_dir, remarkable_archive_dir, zotero_library, tags } = config
        this.remarkable_dir = remarkable_dir
        this.remarkable_archive_dir = remarkable_archive_dir
        this.zotero_library = zotero_library
        this.tags = tags

        this.zapi = new ZAPI()
        this.rmapi = new RMAPI()
    }
}

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