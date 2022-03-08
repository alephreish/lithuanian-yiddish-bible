'use strict'

// Packages
const
	request  = require('request'),
	cheerio  = require('cheerio'),
	fs       = require('fs'),
	util     = require('util'),
	stream   = require('stream')

const config = require('../config')
const numbers = require('./numbers')

const requestHeaders = {
	"User-Agent": "nodejs/request <andrey.rozen@technion.ac.il>"
}

/**
 * Get data via http
 *
 * @param remoteUrl <String>   remote URI
 * @param opts      <Object>   options (qs, form, stream, post)
 *
 * @return <Promise>
 */
function httpRequest(remoteUrl, opts) {
	const options = { url: remoteUrl, timeout: 10000, pool: { maxSockets: 10 } }

	return new Promise((resolve, reject) => {
		request(options, (err, response, data) => err ? reject(err) : resolve(cheerio.load(data)))
	})
}

async function run() {
	const $ = await httpRequest(config.root)
	$('h1 a').each(async function (i, elem) {
		const title = $(this).text().trim()
		const href  = $(this).attr('href')
		if (i == 0 && !title.startsWith("Print:")) {
			const page = await httpRequest(href)
			const content = page('div#content')
			const lines = content.text().split("\n")
			let prakim = []
			let perek_num
			for (let line of lines) {
				line = line.replace(/[ ]/g, ' ').trim()
				if (line == "◊") continue
				if (line == "חזק") break
				let match = line.match("≡≡ פּרק (.+) ≡≡")
				if (match) {
					perek_num = numbers[match[1]]
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
			for (let perek_num in prakim) {
				let perek = prakim[perek_num]
				for (let pasuk of perek.matchAll(/\(([^)]+)\) ([^(]+)/g)) {
					let pasuk_num = numbers[pasuk[1]]
					if (!pasuk_num) {
						throw new Error("Unexpected number: " + pasuk[1])
					}
					let pasuk_text = pasuk[2].trim()
					let line = util.format('%s,%s,"%s"', perek_num, pasuk_num, pasuk_text)
					console.log(line)
				}
			}
		}
	});
}

module.exports = {
	run: run
}
