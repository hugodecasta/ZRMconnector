const z_api = require('./junk/z_api')
const rm_api = require('./junk/rm_api')
const dl_paper = require('./get_paper_api')
const api = require('zotero-api-client')

// -------------------------------------------------------------- PROCESSING DATA

const local_pdf_dir = './pdfs'
const rm_papers_dir = '/AIbstract/Articles'
const tags_dir_link = {
    'hugo - done': 'done',
    'hugo - reading': 'reading',
    'hugo - toread': 'to read',
}
const used_tags = Object.keys(tags_dir_link)
const used_dirs = Object.values(tags_dir_link)

// let old_logger = console.log
// console.log = () => {
//     old_logger('DISPLAY', 54)
// }

// -------------------------------------------------------------- MAIN

function clone(obj) {
    return JSON.parse(JSON.stringify(obj))
}

async function sleep(milliseconds) {
    return new Promise((ok) => setTimeout(ok, milliseconds))
}

async function prepare_rm_dirs() {
    await Promise.all(used_dirs.map(dir_name => rm_api.create_dir(rm_papers_dir, dir_name)))
}

async function get_all_papers(papers) {
    let ret_papers = {}
    for (let paper of papers) {
        let { title, atts } = paper
        if (!atts) {
            console.log('no atts for', title)
            continue
        }
        let att = atts.filter(att => att.contentType == 'application/pdf')[0] ?? atts[0]
        try {
            let path = await dl_paper(title, att.url, att.contentType, local_pdf_dir)
            paper.file_path = path
        } catch (e) {
            console.log('cannot dl', title, e)
        }
        ret_papers[title] = paper
    }
    return ret_papers
}

async function get_z_state() {
    return Object.fromEntries(
        Object.entries(await z_api.get_taged_articles(used_tags))
            .map(([tag, articles]) => [tag, articles.map(a => a.title)])
    )
}

async function get_rm_state() {
    rm_api.reset_dirs()
    return Object.fromEntries(await Promise.all(Object.entries(tags_dir_link).map(async ([tag, dir]) => {
        let full_dir = rm_papers_dir + '/' + dir
        let articles = Object.keys(await rm_api.get_dir_content(full_dir)).map(path => path.replace(full_dir + '/', ''))
        return [tag, articles]
    })))
}

function state_diff(from_state, to_state) {
    let all_titles = Object.values(from_state).concat(Object.values(to_state)).flat()
        .filter((e, i, s) => s.indexOf(e) == i)
    return all_titles
        .map(title => ({
            title,
            'from': used_tags.filter(tag => from_state[tag].includes(title))[0],
            'to': used_tags.filter(tag => to_state[tag].includes(title))[0],
        }))
        .filter(({ from, to }) => from != to)
        .map(({ title, from, to }) => ({ title, action: from ? to ? 'move' : 'remove' : 'add', from, to }))
}

let common_api = {
    'rm': {
        add: async (paper, from, to) => {
            try {
                await rm_api.push_pdf(rm_papers_dir + '/' + tags_dir_link[to], paper.file_path, paper.title)
            } catch (e) { console.log(e) }
        },
        remove: async (paper, from, to) => console.log('paper rm remove not implemented yet'),
        move: async (paper, from, to) => {
            await rm_api.move(rm_papers_dir + '/' + tags_dir_link[from] + '/' + paper.title, rm_papers_dir + '/' + tags_dir_link[to])
        }
    },
    'z': {
        add: async (paper, from, to) => console.log('no paper adding from rm to z'),
        remove: async (paper, from, to) => console.log('paper rm remove not implemented yet'),
        move: async (paper, from, to) => await z_api.change_tags(paper.key, [from], [to]),
    },
}

async function act_diff(papers, diffs, api) {
    for (let { action, title, from, to } of diffs) {
        console.log(action, api, title, from, to)
        if (papers[title])
            await common_api[api][action](papers[title], from, to)
        else
            console.log('cannot act on', title)
    }
}

async function init() {
    console.log('prepare dirs')
    await prepare_rm_dirs()
    console.log('read zotero papers data + download')
    let z_taged = await z_api.get_taged_articles(used_tags)
    let papers = await get_all_papers(Object.values(z_taged).flat())
    console.log('checking init states')
    let rm_state = await get_rm_state()
    let z_state = await get_z_state()
    let diffs = state_diff(rm_state, z_state)
    await act_diff(papers, diffs, "rm")
    return papers
}

//----------------- TODO --> EMPACKAGTAEG !!!!!

let last_rm_state = null
let last_z_state = null
async function listener(papers) {
    let current_rm_state = await get_rm_state()
    let current_z_state = await get_z_state()
    if (last_rm_state && last_z_state) {

        let rm_diff = state_diff(last_rm_state, current_rm_state)
        let z_diff = state_diff(last_z_state, current_z_state)

        console.log('RM diff', rm_diff)
        console.log('Z diff', z_diff)

        await act_diff(papers, rm_diff, 'z')
        await act_diff(papers, z_diff, 'rm')

        current_rm_state = await get_rm_state()
        current_z_state = await get_z_state()

    }
    last_rm_state = clone(current_rm_state)
    last_z_state = clone(current_z_state)
}

async function setup_listener(papers) {
    setInterval(() => listener(papers), 10 * 1000)
    listener(papers)
}

async function main() {

    let papers = await init()
    await setup_listener(papers)

    // console.log('prepare dirs')
    // await prepare_rm_dirs()
    // console.log(await rm_api.get_paths())
    // console.log('read zotero papers data')
    // let z_taged = await z_api.get_taged_articles(used_tags)
    // console.log('download papers')
    // await get_all_papers(Object.values(z_taged).flat())
    // console.log(z_taged)
    // console.log('uploading papers')
    // await upload_papers(z_taged)

    // console.log('DONE')
}

main()

// get_taged_articles().then(console.log)
// create_dir(rm_papers_dir, 'tags').then(console.log).catch(console.error)
// rm_get_doc('039495a7-59e3-4698-a80e-a6b427fb23ef').then(console.log)
// rm_get_doc('330163ad-0fec-4c3f-9354-d8a3c20cb404').then(console.log)