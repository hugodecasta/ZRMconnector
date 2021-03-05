const fetch = require('node-fetch')
const fs = require('fs')

// ---- SCIHUB
async function get_scihub_pdf(article_url) {
    let scihub_url = 'https://sci-hub.st'
    let url = scihub_url + '/' + article_url
    console.log('getting from SCIHUB', article_url, url)
    let resp = await fetch(url)
    let text = await resp.text()
    console.log('END OF SH retrieval', article_url)
    if (text.includes('%%EOF'))
        return resp.url
    else
        return /<iframe src = "(.*?)" id = "pdf">/g.exec(text)[1]
}

const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
});

async function download_paper(title, url, content_type, dir) {
    let filename = title + '.pdf'
    let path = dir + '/' + filename
    if (fs.existsSync(path)) return path
    if (content_type == 'application/pdf' || url.includes('.pdf')) {
        await downloadFile(url, path)
    } else {
        let new_url = await get_scihub_pdf(url)
        await downloadFile(new_url, path)
    }
    return path
}

module.exports = download_paper