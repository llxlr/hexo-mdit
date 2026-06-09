/* global hexo */

'use strict';

hexo.config.markdown = Object.assign({
  preset: 'default',
  render: {},
  plugins: [],
  anchors: {}
}, hexo.config.markdown);

hexo.config.markdown.render = Object.assign({
  html: true,
  xhtmlOut: false,
  breaks: true,
  linkify: true,
  typographer: true,
  quotes: '“”‘’',
  tab: ''
}, hexo.config.markdown.render);

hexo.config.markdown.anchors = Object.assign({
  level: 2,
  collisionSuffix: '',
  permalink: false,
  permalinkClass: 'header-anchor',
  permalinkSide: 'left',
  permalinkSymbol: '\u00b6',
  case: 0,
  separator: '-'
}, hexo.config.markdown.anchors);

const Renderer = require('./lib/renderer');
const renderer = new Renderer(hexo);

renderer.disableNunjucks = Boolean(hexo.config.markdown.disableNunjucks);

// Hexo 8 requires register fn to be a callable function, not an object instance.
// Wrap the renderer instance so Hexo's typeof fn !== 'function' check passes.
const render = function(data, options) {
  return renderer.render(data, options);
};
render.disableNunjucks = renderer.disableNunjucks;
render.compile = renderer.render.bind(renderer);

hexo.extend.renderer.register('md', 'html', render, true);
hexo.extend.renderer.register('markdown', 'html', render, true);
hexo.extend.renderer.register('mkd', 'html', render, true);
hexo.extend.renderer.register('mkdn', 'html', render, true);
hexo.extend.renderer.register('mdwn', 'html', render, true);
hexo.extend.renderer.register('mdtxt', 'html', render, true);
hexo.extend.renderer.register('mdtext', 'html', render, true);


if (hexo.config.minify) {
    // HTML minifier
    hexo.config.minify.html = Object.assign({
        enable: true,
        logger: true,
        stamp: true,
        exclude: [],
        ignoreCustomComments: [/^\s*more/],
        removeComments: true,
        removeCommentsFromCDATA: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeEmptyAttributes: true,
        minifyJS: true,
        minifyCSS: true,
    }, hexo.config.minify.html);

    // Css minifier
    hexo.config.minify.css = Object.assign({
        enable: true,
        logger: true,
        stamp: true,
        exclude: ['*.min.css']
    }, hexo.config.minify.css);

    // Js minifier
    hexo.config.minify.js = Object.assign({
        enable: true,
        mangle: true,
        logger: true,
        stamp: true,
        output: {},
        compress: {},
        exclude: ['*.min.js']
    }, hexo.config.minify.js, {
        fromString: true
    });


    var filter = require('./lib/filter');

    hexo.extend.filter.register('after_render:html', filter.logic_html);
    hexo.extend.filter.register('after_render:css', filter.logic_css);
    hexo.extend.filter.register('after_render:js', filter.logic_js);

}