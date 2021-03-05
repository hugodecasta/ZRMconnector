const credentials = require('./credentials_api')
const MAIN_ZOTERO = require('zotero');

class ZOTERO_API {

    // ----------------------------------------- CONSTRUCTION

    constructor() {
        this.zotero_root_endpoint = null
        this.current_endpoint = null
        this.is_group = false
    }

    // ----------------------------------------- API ROOT

    async zotero_credentials() {
        let { key, user_id } = credentials.get_credentials('zotero') ?? {}
        if (!key || !user_id) {
            key = await credentials.ask_credentials('Zotero API key')
            user_id = await credentials.ask_credentials('Zotero user_id')
            credentials.set_credentials('zotero', { key, user_id })
        }
        return { key, user_id }
    }

    async get_root_api() {
        if (!this.zotero_root_endpoint)
            this.zotero_root_endpoint =
                require('zotero-api-client')((await this.zotero_credentials()).key)
                    .library('user', (await this.zotero_credentials()).user_id);
        return this.zotero_root_endpoint
    }

    async get_user_endpoint() {
        return (await this.get_root_api()).library('user', (await this.zotero_credentials()).user_id)
    }

    async get_current_endpoint() {
        if (!this.current_endpoint) await this.goto_root()
        return this.current_endpoint
    }

    // ----------------------------------------- UPDATE API

    async init_zotero_stream() {
        if (!this.zotero_stream) {
            this.stream_actions = []
            let apiKey = (await this.zotero_credentials()).key
            this.zotero_stream = new MAIN_ZOTERO.Stream({ apiKey });
            this.zotero_stream.on('topicUpdated', (data) => {
                this.stream_actions.forEach(action => action(data))
            });
        }
    }

    async register_func_change(func) {
        await this.init_zotero_stream()
        this.stream_actions.push(func)
    }

    // ----------------------------------------- GOTO

    async goto_root() {
        this.is_group = false
        this.current_endpoint = await this.get_root_api()
    }

    async goto_group(group_name) {
        let groups = (await (await this.get_user_endpoint()).groups().get()).raw
        let id = groups.filter(({ data: { name: found_name } }) => found_name == group_name).pop().id
        this.current_endpoint = (await this.get_current_endpoint()).library('group', id)
        this.is_group = true
    }

    async goto_collection(collection_name) {
        let collections = (await (await this.get_current_endpoint()).collections().get()).raw
        let key = collections.filter(({ data: { name: found_name } }) => found_name == collection_name).pop().key
        return this.current_endpoint = (await this.get_current_endpoint()).collections(key)
    }

    // ----------------------------------------- ACTIONS

    async get_items() {
        let items = (await (await this.get_current_endpoint()).items().get())
        return items.raw
    }

    async set_document(key, document) {
        return await (await (this.is_group ? this.get_current_endpoint() : this.get_user_endpoint())).items([key]).put(document)
    }

    async get_document(key) {
        return (await (await (this.is_group ? this.get_current_endpoint() : this.get_user_endpoint())).items([key]).get()).raw
    }

    async change_tags(key, del_tags, add_tags) {
        let article = await this.get_document(key)
        let tags = [...add_tags, ...article.data.tags.map(({ tag }) => tag).filter(tag => !del_tags.includes(tag))]
        article.data.tags = tags.map(tag => ({ tag }))
        return await this.set_document(key, article)
    }

}

module.exports = ZOTERO_API