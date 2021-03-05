const credentials = require('./credentials_api')

class ZOTERO_API {

    // ----------------------------------------- CONSTRUCTION

    constructor() {
        this.zotero_root_endpoint = null
        this.current_endpoint = null
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

    // ----------------------------------------- GOTO

    async goto_root() {
        this.current_endpoint = await this.get_root_api()
    }

    async goto_group(group_name) {
        let groups = (await (await this.get_user_endpoint()).groups().get()).raw
        let id = groups.filter(({ data: { name: found_name } }) => found_name == group_name).pop().id
        return this.current_endpoint = (await this.get_current_endpoint()).library('group', id)
    }

    async goto_collection(collection_name) {
        let collections = (await (await this.get_current_endpoint()).collections().get()).raw
        let key = collections.filter(({ data: { name: found_name } }) => found_name == collection_name).pop().key
        return this.current_endpoint = (await this.get_current_endpoint()).collections(key)
    }

    // ----------------------------------------- ACTIONS

    async get_items() {
        return (await (await this.get_current_endpoint()).items().get()).raw
    }

    async set_document(key, document) {
        return await (await this.get_current_endpoint()).items([key]).put(document)
    }

    async get_document(key) {
        return (await (await this.get_current_endpoint()).items([key]).get()).raw
    }

    async change_tags(key, del_tags, add_tags) {
        let article = await this.get_document(key)
        let tags = [...add_tags, ...article.data.tags.map(({ tag }) => tag).filter(tag => !del_tags.includes(tag))]
        article.data.tags = tags.map(tag => ({ tag }))
        return await this.set_document(key, article)
    }

}

module.exports = ZOTERO_API