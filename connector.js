const ZAPI = require('./zotero_api')
const RMAPI = require('./remarkable_api')
const util = require('util')
const fs = require('fs')
const download_paper = require('./download_paper_api')
const log = require('log-to-file');

const local_pdf_dir = './pdfs_data'
const connector_states_dir = './conn_states_data'

process.connector_lock = false

async function wait_immediate() {
    return new Promise(ok => {
        // setTimeout(ok, 100) // ---- DEBUG !!
        setImmediate(ok)
    })
}
async function wait_for_lock() {
    while (process.connector_lock) await wait_immediate()
}

class CONNECTOR {

    // ----------------------------------------- CONSTRUCTION
    constructor(name, config) {

        this.name = name

        let { remarkable_dir, remarkable_archive_dir, zotero_path, tags } = config
        this.remarkable_dir = remarkable_dir
        this.remarkable_archive_dir = remarkable_archive_dir
        this.zotero_path = zotero_path
        this.tags = tags

        this.used_tags = Object.keys(this.tags)
        this.used_dirs = Object.values(this.tags)

        this.states_file = connector_states_dir + '/' + name + '.json'

        this.zapi = new ZAPI()
        this.rmapi = new RMAPI()
    }

    log() {
        let str = 'CONN[' + this.name + ']::' + Array.from(arguments).map(arg => util.format(arg)).join(' ')
        console.log(str)
        log(str, 'logs.log');
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

    async act_diff(papers, diffs, api) {

        let common_api = {
            'rm': {
                add: async (paper, from, to) =>
                    await this.rmapi.upload_pdf(
                        this.remarkable_dir + '/' + this.tags[to],
                        paper.title,
                        paper.file_path
                    ),
                remove: async (paper, from, to) =>
                    await this.rmapi.move(
                        this.remarkable_dir + '/' + this.tags[from] + '/' + paper.title,
                        this.remarkable_archive_dir
                    ),
                move: async (paper, from, to) => {
                    await this.rmapi.move(
                        this.remarkable_dir + '/' + this.tags[from] + '/' + paper.title,
                        this.remarkable_dir + '/' + this.tags[to]
                    )
                }
            },
            'z': {
                add: async (paper, from, to) => await this.zapi.change_tags(paper.key, [], [to]),
                remove: async (paper, from, to) => await this.zapi.change_tags(paper.key, [from], []),
                move: async (paper, from, to) => await this.zapi.change_tags(paper.key, [from], [to]),
            },
        }

        let inhib_name = 'inhib_' + api

        this[inhib_name] = true

        for (let { action, title, from, to } of diffs) {
            if (papers[title] || action == 'remove') {
                this.log('ACT', api, action, from, to, title)
                let paper = papers[title] ?? { title }
                await common_api[api][action](paper, from, to)
            }
            else
                this.log('cannot act on', title)
        }
        setTimeout(() => this[inhib_name] = false, 2000)

    }

    // ----------------------------------------- PAPERS

    async get_zotero_papers() {
        let articles = await this.zapi.get_items()
        let usefull_items = Object.fromEntries(articles
            .map(({ key, data: { title, tags } }) => ({ key, title, tags: tags.map(({ tag }) => tag) }))
            .filter(({ tags }) => tags.filter(tag => this.used_tags.includes(tag)).length > 0)
            .map(art => [art.key, art])
        )
        articles.filter(({ data: { itemType } }) => itemType == 'attachment')
            .filter(({ data: { parentItem } }) => parentItem in usefull_items)
            .forEach(({ key, data: { parentItem, url, contentType } }) => usefull_items[parentItem].atts ?
                usefull_items[parentItem].atts.push({ key, url, contentType })
                :
                usefull_items[parentItem].atts = [{ key, url, contentType }]
            )
        return Object.fromEntries(this.used_tags.map(tag => [tag,
            Object.values(usefull_items).filter(({ tags }) => tags.includes(tag))]))
    }

    async get_papers() {
        let papers = Object.values(await this.get_zotero_papers()).flat()
        let ret_papers = {}
        for (let paper of papers) {
            let { title, atts } = paper
            if (!atts) {
                this.log('no attachment for', title)
                continue
            }
            let att = atts.filter(att => att.contentType == 'application/pdf')[0] ?? atts[0]
            try {
                let path = await download_paper(title, att.url, att.contentType, local_pdf_dir)
                paper.file_path = path
            } catch (e) {
                this.log('cannot download pdf', title, e)
            }
            ret_papers[title] = paper
        }
        return ret_papers
    }

    // ----------------------------------------- STATES

    async get_rm_state() {
        this.rmapi.reset_dirs()
        return Object.fromEntries(await Promise.all(Object.entries(this.tags).map(async ([tag, dir]) => {
            let full_dir = this.remarkable_dir + '/' + dir
            let articles = Object.keys(await this.rmapi.get_path_content(full_dir)).map(path => path.replace(full_dir + '/', ''))
            return [tag, articles]
        })))
    }

    async get_z_state() {
        return Object.fromEntries(
            Object.entries(await this.get_zotero_papers())
                .map(([tag, articles]) => [tag, articles.map(a => a.title)])
        )
    }

    load_states() {
        this.last_rm_state = null
        this.last_z_state = null
        if (!fs.existsSync(this.states_file)) return null
        let { rm, z } = JSON.parse(fs.readFileSync(this.states_file, 'utf8'))
        this.last_rm_state = rm
        this.last_z_state = z
        return true
    }

    save_states() {
        let states = { rm: this.last_rm_state, z: this.last_z_state }
        fs.writeFileSync(this.states_file, JSON.stringify(states), 'utf8')
    }

    // ----------------------------------------- CHECKER

    async first_check() {
        let current_rm_state = await this.get_rm_state()
        let current_z_state = await this.get_z_state()
        let rm_diff = this.state_diff(current_rm_state, current_z_state)
        await this.act_diff(await this.get_papers(), rm_diff, 'rm')
        this.last_rm_state = this.clone(current_rm_state)
        this.last_z_state = this.clone(current_z_state)
        this.save_states()
    }

    async checker() {

        this.log('waiting for lock')
        await wait_for_lock()
        process.connector_lock = true

        this.log('check')

        this.load_states()

        let current_rm_state = await this.get_rm_state()
        let current_z_state = await this.get_z_state()

        if (this.last_rm_state && this.last_z_state) {

            let papers = await this.get_papers()

            let rm_diff = this.state_diff(this.last_rm_state, current_rm_state)
            let z_diff = this.state_diff(this.last_z_state, current_z_state)

            await this.act_diff(papers, rm_diff, 'z')
            await this.act_diff(papers, z_diff, 'rm')

            current_rm_state = await this.get_rm_state()
            current_z_state = await this.get_z_state()

        }
        this.last_rm_state = this.clone(current_rm_state)
        this.last_z_state = this.clone(current_z_state)

        this.save_states()
        this.log('end check')
        process.connector_lock = false
    }

    // ----------------------------------------- LAUNCHER
    async launch() {

        // ---- setup dirs
        this.log('setup local_directories', this.remarkable_dir)
        if (!fs.existsSync(local_pdf_dir)) fs.mkdirSync(local_pdf_dir)
        if (!fs.existsSync(connector_states_dir)) fs.mkdirSync(connector_states_dir)

        // ---- setup remarkable
        this.log('preparing RM directory', this.remarkable_dir)
        await Promise.all(this.used_dirs.map(dir_name => this.rmapi.mkdir(this.remarkable_dir, dir_name)))
        if (!(await this.rmapi.path_exists(this.remarkable_archive_dir))) {
            let sp = this.remarkable_archive_dir.split('/')
            let dir_name = sp.pop()
            let parent_dir = sp.join('/')
            await this.rmapi.mkdir(parent_dir, dir_name)
        }

        // ---- setup zotero api
        this.log('setting up Zotero API')
        for (let { type, name } of this.zotero_path) {
            if (type == 'group') await this.zapi.goto_group(name)
            else if (type == 'collection') await this.zapi.goto_collection(name)
        }

        // ---- first check
        if (!this.load_states()) {
            this.log('first check')
            await this.first_check()
        }

        // ---- setup interval
        this.log('setup checker')
        await this.zapi.register_func_change((data) => {
            this.log('update from zotero, act :', !this.inhib_z)
            if (this.inhib_z) return
            this.checker()
        })
        await this.rmapi.register_func_change((data) => {
            this.log('update from remarkable, act :', !this.inhib_rm)
            if (this.inhib_rm) return
            this.checker()
        })
        this.checker()

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