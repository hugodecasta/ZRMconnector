const credentials = require('./credentials_api')
const { authenticateDevice, authenticateUser, getStorageHost, docs, updateStatus, uploadRequest, deleteItem }
    = require('remarkable-tablet-api')
const AdmZip = require('adm-zip');
const fetch = require('node-fetch')
const WebSocket = require('ws')

class REMARKABLE_API {

    // ----------------------------------------- CONSTRUCTION

    constructor() {
        this.rm_host = null
        this.reset_dirs()
    }

    // ----------------------------------------- API ROOT

    async remarkable_credentials() {
        let user_token = credentials.get_credentials('remarkable')
        if (!user_token) {
            let code = await credentials.ask_credentials('ReMarkable One Time Code')
            const { token } = await authenticateDevice(code);
            user_token = await authenticateUser(token);
            credentials.set_credentials('remarkable', user_token)
        }
        return user_token
    }
    async rmcode() {
        return await this.remarkable_credentials()
    }
    async rmhost() {
        if (!this.rm_host) this.rm_host = await getStorageHost()
        return this.rm_host
    }

    // ----------------------------------------- UPDATE API

    async init_remarkable_websocket() {
        if (!this.remarkable_websocket) {
            this.websocket_actions = []
            let service_url = 'https://service-manager-production-dot-remarkable-production.appspot.com/service/json/1/'
            let service = 'notifications'
            let args = '?environment=production&group=auth0%7C5a68dc51cb30df1234567890&apiVer=1'
            let url = service_url + service + args
            let user_token = await this.remarkable_credentials()
            let userAgent = 'remarkable-api'
            let options = {
                headers: {
                    'User-Agent': userAgent,
                    Authorization: `Bearer ${user_token}`,
                }
            }
            let host = (await (await fetch(url, options)).json()).Host
            let full_url = 'wss://' + host + '/notifications/ws/json/1'
            const ws = new WebSocket(full_url, options);
            ws.on('message', (data) => {
                this.websocket_actions.forEach(action => action(data))
            });
        }
    }

    async register_func_change(func) {
        await this.init_remarkable_websocket()
        this.websocket_actions.push(func)
    }

    // ----------------------------------------- UTILS

    reset_dirs() {
        this.dirs = null
        this.paths = null
    }

    async get_dirs() {
        if (this.dirs) return this.dirs
        let collections = await docs(await this.rmhost(), await this.rmcode())
        this.dirs = Object.fromEntries(collections
            .map(({ ID, VissibleName, Parent }) => [ID, { ID, VissibleName, Parent }])
        )
        let paths = {}
        let find_path = (collection) => {
            if (!collection) return 'trash'
            if (collection.ID in paths) return paths[collection.ID]
            if (!collection.Parent) return paths[collection.ID] = '/' + collection.VissibleName
            return paths[collection.ID] = find_path(this.dirs[collection.Parent]) + '/' + collection.VissibleName
        }
        for (let ID in this.dirs) {
            this.dirs[ID].path = find_path(this.dirs[ID])
        }
        return this.dirs
    }

    async get_dir_id(dir) {
        if (dir == 'trash') return 'trash'
        return (await this.get_paths())[dir]
    }

    async path_exists(path) {
        return (await this.get_dir_id(path)) != undefined
    }

    async set_status(ID, Parent, Name, Version, Type) {
        let res_upd = await updateStatus(await this.rmhost(), await this.rmcode(), {
            id: ID,
            parent: Parent,
            visibleName: Name,
            version: Version,
            type: Type,
            dateModified: (new Date()).toISOString(),
        })
        this.reset_dirs()
        return res_upd
    }

    async create_doc(dir, name, type, get_buffer) {
        let full_path = dir + '/' + name
        if (await this.path_exists(full_path)) return { error: 'already exists' }
        let dir_id = await this.get_dir_id(dir)
        if (!dir_id) throw 'parent directory ' + parent_dir + ' does not exists'
        const { docId, uploadUrl } = await uploadRequest(await this.rmhost(), await this.rmcode());
        await fetch(uploadUrl, {
            method: 'PUT', body: get_buffer(docId),
            headers: {
                Authorization: `Bearer ${await this.rmcode()}`,
            },
        });
        return await this.set_status(docId, dir_id, name, 1, type)
    }

    // ----------------------------------------- ACTIONS

    // ---------------------------- GET
    async get_paths() {
        if (this.paths) return this.paths
        let dirs = await this.get_dirs()
        return this.paths = Object.fromEntries(Object.entries(dirs).map(([ID, { path }]) => [path, ID]))
    }
    async get_path_content(dir) {
        return Object.fromEntries(Object.entries(await this.get_paths()).filter(([path]) => path.includes(dir) && path != dir))
    }
    async get_path_content_direct(dir) {
        return Object.fromEntries(Object.entries(await this.get_paths())
            .filter(([path]) => path.includes(dir) && path != dir && path.replace(dir + '/', '').split('/').length == 1)
        )
    }
    async get_document(doc_id) {
        return (await docs(await this.rmhost(), await this.rmcode(), { id: doc_id }))[0]
    }

    // ---------------------------- CREATE
    async mkdir(parent_dir, dir_name) {
        return await this.create_doc(parent_dir, dir_name, 'CollectionType', (docId) => {
            const docZip = new AdmZip();
            docZip.addFile(`${docId}.content`, Buffer.from('{}'));
            return docZip.toBuffer();
        })
    }
    async upload_pdf(dir, name, local_pdf_path) {
        return await this.create_doc(dir, name, 'DocumentType', (docId) => {
            const docZip = new AdmZip();
            const metadata = {
                extraMetadata: {},
                fileType: 'pdf',
                lastOpenedPage: 0,
                lineHeight: -1,
                margins: 180,
                textScale: 1,
                transform: {},
            };
            docZip.addFile(`${docId}.content`, Buffer.from(JSON.stringify(metadata)));
            docZip.addFile(`${docId}.pagedata`, Buffer.from(''));
            docZip.addLocalFile(local_pdf_path, '', `${docId}.pdf`);
            return docZip.toBuffer();
        })
    }

    // ---------------------------- ALTER
    async delete_doc(full_path) {
        let id = await this.get_dir_id(full_path)
        let doc = await this.get_document(id)
        this.reset_dirs()
        return await deleteItem(await this.rmhost(), await this.rmcode(), doc.ID, doc.Version)
    }
    async move(full_path, new_dir) {
        let base_id = await this.get_dir_id(full_path)
        let new_dir_id = await this.get_dir_id(new_dir)
        let doc = await this.get_document(base_id)
        await this.set_status(base_id, new_dir_id, doc.VissibleName, doc.Version + 1, doc.Type)
    }

}

module.exports = REMARKABLE_API