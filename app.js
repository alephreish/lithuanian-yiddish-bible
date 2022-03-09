'use strict'

// Packages
const
    request  = require('request'),
    cheerio  = require('cheerio'),
    util     = require('util'),
    stream   = require('stream'),
    fs       = require('fs')

const config  = require('./config')
const numbers = require('./numbers')
const wide_letters = require('./wide_letters')

const requestHeaders = {
    "User-Agent": "nodejs/request <alephreish@gmail.com>"
}

function httpRequest(remoteUrl, cache, opts) {
    return new Promise((resolve, reject) => {
        fs.access(cache, error => {
            if (error) {
                const options = { url: remoteUrl, timeout: 10000, pool: { maxSockets: 10 } }
                request(options, (err, response, data) => {
                    if (err) {
                        reject(err)
                    } else {
                        fs.writeFile(cache, data, (err) => err ? reject(err) : resolve(cheerio.load(data)))
                    }
                })
            }
            else {
                fs.readFile(cache, (err, data) => err ? reject(err) : resolve(cheerio.load(data)))
            }
        })
    })
}

function streamEnd(ws) {
    ws.end()
    return new Promise((resolve, reject) => {
        ws.on("finish", () => resolve(ws))
        ws.on("error", reject)
    })
}

function replaceAll(str, map){
    for (let key in map){
        str = str.replaceAll(key, map[key])
    }
    return str
}

async function run() {
    const $ = await httpRequest(config.root, "html/root.html")
    for (const elem of $('h1 a')) {
        const title = $(elem).text().trim()
        console.error(title)
        const href  = $(elem).attr('href')
        if (!title.startsWith("Print:")) {
            const page = await httpRequest(href, "html/" + title + ".html")
            const content = page('div#content')
            const lines = content.text().split("\n")
            let prakim = []
            let perek_num
            for (let line of lines) {
                line = line.replace(/[ ]/g, ' ').trim()
                line = replaceAll(line, wide_letters)
                if (line == "◊") continue
                if (line == "חזק") break
                let match = line.match("≡≡ פּרק (.+) ≡≡")
                if (match) {
                    perek_num = numbers[match[1].trim()]
                    if (!perek_num) {
                        throw new Error("Unexpected number: " + match[1])
                    }
                    prakim[perek_num] = ""
                    continue
                }
                if (perek_num) {
                    prakim[perek_num] += ' ' + line.replace(/\s{2,}/g, ' ').trim()
                }
            }
            const ws = fs.createWriteStream("csv/" + title + ".csv")
            for (let perek_num in prakim) {
                let perek = prakim[perek_num]
                for (let pasuk of perek.matchAll(/\(([^)]{1,3})\) ([^(]+)/g)) {
                    let pasuk_num = numbers[pasuk[1].trim()]
                    if (!pasuk_num) {
                        throw new Error("Unexpected number: " + pasuk[1])
                    }
                    let pasuk_text = pasuk[2].trim()
                    let line = util.format('%s:%s,"%s"\n', perek_num, pasuk_num, pasuk_text)
                    console.log(line)
                    ws.write(line)
                }
            }
            await streamEnd(ws)
        }
    }
}

run()
