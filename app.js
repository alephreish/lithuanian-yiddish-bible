'use strict'

// Packages
const
    request  = require('request'),
    cheerio  = require('cheerio'),
    util     = require('util'),
    stream   = require('stream'),
    fs       = require('fs')

const
    config  = require('./config'),
    numbers = require('./numbers'),
    books   = require('./books'),
    wide_letters = require('./wide_letters')

function httpRequest(remoteUrl, cache, opts) {
    return new Promise((resolve, reject) => {
        fs.access(cache, error => {
            if (error) {
                const options = { url: remoteUrl, timeout: 10000, pool: { maxSockets: 10 } }
                request(options, (err, response, data) => {
                    if (err) reject(err)
                    else fs.writeFile(cache, data, (err) => err ? reject(err) : resolve(cheerio.load(data)))
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
        const href  = $(elem).attr('href')
        if (!title.startsWith("Print:")) {
            console.error(title)
            let exp_prakim = books[title]
            if (!exp_prakim) {
                throw new Error("Unknown book: " + title)
            }
            const page = await httpRequest(href, "html/" + title + ".html")
            const content = page('div#content')
            const lines = content.text().split("\n")
            let prakim = []
            let perek_num
            for (let line of lines) {
                line = line.replaceAll(" ", " ").trim()
                line = replaceAll(line, wide_letters)
                if (line == "◊") continue
                if (line == "חזק") break
                let match = line.match("≡≡ פּרק (.+) ≡≡")
                if (match) {
                    perek_num = numbers[match[1].trim()]
                    if (!perek_num) {
                        throw new Error("Unexpected number: " + match[1])
                    }
                    if (!(perek_num in exp_prakim)) {
                        throw new Error("Unexpected number: " + perek_num)
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
                let last_pasuk = 0
                for (let pasuk of perek.matchAll(/\(([^,)]{1,3})\),? ([(]?[^(]+)/g)) {
                    let pasuk_num = numbers[pasuk[1].trim()]
                    //console.log(pasuk[2].trim())
                    if (!pasuk_num) {
                        throw new Error("Unexpected number: " + pasuk[1])
                    }
                    if (pasuk_num != last_pasuk + 1) {
                        throw new Error(util.format("Found pasuk %s after pasuk %s in perek %s", pasuk_num, last_pasuk, perek_num))
                    }
                    let pasuk_text = pasuk[2].trim()
                    let line = util.format('%s:%s,"%s"\n', perek_num, pasuk_num, pasuk_text)
                    ws.write(line)
                    last_pasuk = pasuk_num
                }
                //let exp_psukim = exp_prakim[perek_num]
                //if (last_pasuk != exp_psukim) {
                //    throw new Error(util.format("Found %s psukim instead of %s in perek %s", last_pasuk, exp_psukim, perek_num))
		//}
            }
            await streamEnd(ws)
        }
    }
}

run()
