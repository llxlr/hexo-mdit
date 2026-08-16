const mermaidChart = (code, config, style, label = '', caption = '') => {
    const deasyncPromise = require('deasync-promise')

    return deasyncPromise((async () => {
        const path = require('path')
        const { chromium } = require('playwright')

        const GOTO_TIMEOUT = 15000
        let browser

        try {
            browser = await chromium.launch({ headless: true })
            const page = await browser.newPage()
            await page.goto(`file://${path.join(__dirname, 'index.html')}`, {
                waitUntil: 'load',
                timeout: GOTO_TIMEOUT
            })

            const svg = await page.evaluate(async ({ code, config }) => {
                const mermaid = window.mermaid
                if (!mermaid || typeof mermaid.render !== 'function') {
                    throw new Error('window.mermaid.render is not available')
                }
                mermaid.initialize(config)
                const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).slice(2)
                const result = await mermaid.render(id, code)
                return (result && result.svg) ? result.svg : result
            }, { code, config })

            caption = caption ? `<span class="image-info">${caption}</span>` : ''

            return `<pre id="${label}" class="mermaid${style}">${svg}${caption}</pre>`
        } catch (e) {
            const message = (e && e.message) ? e.message : String(e)
            return `<pre>Mermaid render failed: ${message}</pre>`
        } finally {
            if (browser) {
                try {
                    await browser.close()
                } catch (closeError) {
                    // 关闭失败不影响本次渲染结果，忽略以免覆盖原始错误。
                }
            }
        }
    })())

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
        ...(options || {})
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
