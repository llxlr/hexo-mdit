'use strict';

const MarkdownIt = require('markdown-it');
const path = require('path');

const default_plugins = [
    'markdown-it-abbr',
    'markdown-it-bracketed-spans',
    'markdown-it-attrs',
    'markdown-it-deflist',
    'markdown-it-emoji',
    'markdown-it-footnote',
    'markdown-it-ins',
    'markdown-it-mark',
    'markdown-it-multimd-table',
    'markdown-it-sub',
    'markdown-it-sup',
    'markdown-it-task-checkbox',
    'markdown-it-pangu',
    './markdown-it-container',
    './markdown-it-furigana',
    './markdown-it-katex',
    './markdown-it-mermaid',
    './markdown-it-graphviz',
    './markdown-it-prism',
    './markdown-it-chart',
    './markdown-it-spoiler',
    './markdown-it-excerpt'
];

// Helper: merge user‑supplied plugin list with the default list.
//
// The user may supply plugins in two formats:
//   1) hexo‑renderer‑markdown‑it style   →  plugins: ['name', { name, options }]
//   2) hexo‑mdit style                    →  plugins: [{ plugin: { name, enable, options } }]
//
// When `config.plugins` is empty / undefined, **all** default plugins are
// enabled (backward‑compatible behaviour).
/**
 * General default plugin config
 * @param  {List} userPlugins plugin List.
 * @return {List}        plugin List.
 */
function resolvePlugins(userPlugins) {
    // Build a lookup from the user list (hexo‑renderer‑markdown‑it style)
    const userMap = {};
    if (Array.isArray(userPlugins) && userPlugins.length) {
        for (const p of userPlugins) {
            // hexo‑mdit legacy format: { plugin: { name, enable, options } }
            if (p && p.plugin && p.plugin.name) {
                userMap[p.plugin.name] = {
                    name: p.plugin.name,
                    enable: p.plugin.enable !== false,
                    options: p.plugin.options
                };
            }
            // hexo‑renderer‑markdown‑it format: { name, options }
            else if (p && typeof p === 'object' && p.name) {
                userMap[p.name] = {
                    name: p.name,
                    enable: p.enable !== false,
                    options: p.options
                };
            }
            // Simple string
            else if (typeof p === 'string') {
                userMap[p] = { name: p, enable: true };
            }
        }
    }

    // If user provided an explicit plugin list, use ONLY the user list.
    if (Object.keys(userMap).length > 0) {
        return Object.values(userMap);
    }

    // Otherwise enable ALL default plugins (hexo‑mdit behaviour)
    return default_plugins.map(name => ({ name, enable: true }));
}

class Renderer {
    /**
     * @param {import('hexo')} hexo – the Hexo context
     */
    constructor(hexo) {
        this.hexo = hexo;

        let { markdown } = hexo.config;

        // backward compatibility (old string‑only preset)
        if (typeof markdown === 'string') {
            markdown = { preset: markdown };
            if (hexo.log && hexo.log.warn) {
                hexo.log.warn(
                    'Deprecated config detected. Please use\n\n' +
                    `markdown:\n  preset: ${markdown.preset}\n\n` +
                    'See https://github.com/hexojs/hexo-renderer-markdown-it#options'
                );
            }
        }

        const {
            preset,
            render,
            enable_rules,
            disable_rules,
            plugins,
            anchors,
            images,
            toc
        } = markdown || {};

        // create the MarkdownIt instance
        this.parser = new MarkdownIt(preset || 'default', render);

        // enable / disable individual rules
        if (enable_rules) this.parser.enable(enable_rules);
        if (disable_rules) this.parser.disable(disable_rules);

        // load user‑specified plugins (or all defaults)
        const pluginList = resolvePlugins(plugins);
        pluginList.forEach(p => this._loadPlugin(p));

        // toc-and-anchors（合并 anchors + toc 配置，统一切换）
        if (anchors || toc) {
            var combined = Object.assign({}, anchors || {});
            if (toc) {
                combined.toc = true;
                Object.assign(combined, typeof toc === 'object' ? toc : {});
            }
            this._loadPlugin({
                name: './markdown-it-toc-and-anchor',
                enable: true,
                options: combined
            });
        }

        // images (lazyload / prepend_root / post_asset)
        if (images) {
            this._loadPlugin({
                name: './markdown-it-images',
                enable: true,
                options: { images: images, hexo: this.hexo }
            });
        }
    }

    // Load a single plugin (resolves relative paths correctly)
    _loadPlugin({ name, enable, options }) {
        if (!name || enable === false) return;

        let plugin;
        try {
            // Resolve built‑in relative plugins first
            if (name.startsWith('./') || name.startsWith('../')) {
                plugin = require(path.join(__dirname, name));
            } else {
                // Try require.resolve with multiple search paths (like hexo‑renderer‑markdown‑it)
                const resolved = require.resolve(name, {
                    paths: [
                        path.join(this.hexo.base_dir, 'node_modules'),
                        path.join(__dirname, '../../node_modules'),
                        this.hexo.base_dir,
                        path.join(__dirname, '../../')
                    ]
                });
                plugin = require(resolved);
            }

            // Support ES module default export
            if (typeof plugin !== 'function' && typeof plugin.default === 'function') {
                plugin = plugin.default;
            }

            this.parser.use(plugin, options);
        } catch (err) {
            if (this.hexo.log && this.hexo.log.error) {
                this.hexo.log.error(`Failed to load markdown-it plugin "${name}":`, err.message);
            }
        }
    }

    render(data, options) {
        // Allow external plugins / scripts to modify the parser before each render
        if (typeof this.hexo.execFilterSync === 'function') {
            this.hexo.execFilterSync('markdown-it:renderer', this.parser, {
                context: this
            });
        }

        const env = { postPath: data.path };

        if (options && options.inline === true) {
            return this.parser.renderInline(data.text, env);
        }
        return this.parser.render(data.text, env);
    }
}

module.exports = Renderer;
