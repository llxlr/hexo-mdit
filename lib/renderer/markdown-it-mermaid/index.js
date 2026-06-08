const mermaidChart = (code, config, style, label = '', caption = '') => {
    const deasyncPromise = require('deasync-promise')

    return deasyncPromise((async () => {
        try {
            const path = require('path')
            const puppeteer = require('puppeteer')
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                  '--disable-gpu',
                  '--disable-dev-shm-usage',
                  '--disable-setuid-sandbox',
                  '--no-first-run',
                  '--no-sandbox',
                  '--no-zygote',
                  '--single-process'
                ]
            })
            const page = await browser.newPage()
            page.setViewport({ width: 800, height: 600 })
            await page.goto(`file://${path.join(__dirname, 'index.html')}`)

            await page.$eval('#container', (container, code, config) => {
                container.innerHTML = code
                window.mermaid.initialize(config)
                window.mermaid.init(undefined, container)
            }, code, config)
            const svg = await page.$eval('#container', container => {
                container.lastChild.removeChild(container.getElementsByTagName('style')[0])
                return container.innerHTML
            })
            browser.close()

            caption = caption ? `<span class="image-info">${caption}</span>` : ''

            return `<pre id="${label}" class="mermaid${style}">${svg}${caption}</pre>`
        } catch (e) {
            return `<pre>${e}</pre>`
        }
    })())

}

const mermaidChart2 = (code, config, style, label = '', caption = '') => {
    try {
        const { execFileSync } = require('child_process')
        const fs = require('fs')
        const path = require('path')
        const os = require('os')

        const inputPath = path.join(os.tmpdir(), `mermaid-${Date.now()}.mmd`)
        const outputPath = path.join(os.tmpdir(), `mermaid-${Date.now()}.svg`)
        
        // 写入配置+代码
        fs.writeFileSync(inputPath, `%%{init: ${JSON.stringify(config)}}\n${code}`)
        
        // 执行CLI渲染
        execFileSync('mmdc', [
           '-i', inputPath,
           '-o', outputPath,
           '-w', 800, '-H', 600
        ]);
        
        const svg = fs.readFileSync(outputPath, 'utf8')
        [inputPath, outputPath].forEach(p => fs.existsSync(p) && fs.unlinkSync(p))

        // 清理临时文件
        fs.unlinkSync(inputFile)
        fs.unlinkSync(outputFile)
        
        caption = caption ? `<span class="image-info">${caption}</span>` : ''
        return `<pre id="${label}" class="mermaid${style}">${svg}${caption}</pre>`
    } catch (e) {
        return `<pre>${e}</pre>`
    }
}


const matchCaption = (info) => {
    const lang = info.trim().split(" ")[0]
    info = info.slice(lang.length)

    const rLabel = /\s*label:\s*(\S+)/i;
    const rCaptionUrlTitle = /(\S[\S\s]*)\s+(https?:\/\/)(\S+)\s+(.+)/i;
    const rCaptionUrl = /(\S[\S\s]*)\s+(https?:\/\/)(\S+)/i;
    const rCaption = /(\S[\S\s]*)/;

    let label = 0;
    if (rLabel.test(info)) {
        info = info.replace(rLabel, (match, _label) => {
            label = _label;
            return '';
        })
    };

    let caption = '';
    if (rCaptionUrlTitle.test(info)) {
        const match = info.match(rCaptionUrlTitle);
        caption = `<sup class="footnote-ref"><a href="${match[2]}${match[3]}">${match[4]}</a></sup>`;
    } else if (rCaptionUrl.test(info)) {
        const match = info.match(rCaptionUrl);
        caption = `${match[1]}<sup class="footnote-ref"><a href="${match[2]}${match[3]}">link</a></sup>`;
    } else if (rCaption.test(info)) {
        const match = info.match(rCaption);
        caption = `${match[1]}`;
    }

    return { label, caption }
}

module.exports = (md, options) => {

    let config = {
        startOnLoad: false,
        theme: "default",
        flowchart: {
            htmlLabels: false,
            useMaxWidth: true,
        },
        ...options
    }

    const defaultRenderer = md.renderer.rules.fence.bind(md.renderer.rules)

    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const code = token.content.trim()
        const { label, caption } = matchCaption(token.info)

        // if (token.info === 'Mermaid') {
        if (token.info.startsWith("Mermaid")) {
            var firstLine = code.split(/\n/)[0].trim()
            if (firstLine.match(/^graph (?:TB|BT|RL|LR|TD);?$/)) {
                firstLine = ' graph'
            } else {
                firstLine = ''
            }
            return mermaidChart(code, config, firstLine, label, caption)
        }
        return defaultRenderer(tokens, idx, options, env, self)
    }
}