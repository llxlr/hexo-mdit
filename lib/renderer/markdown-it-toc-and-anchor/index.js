'use strict';

var slugize = require('hexo-util').slugize;

var TOC_RE = /^@\[toc\]/im;

var headingIds = {};
var tocHtml = '';

// ---------------------------------------------------------------------------
// 生成安全的锚点 ID（处理重复标题）
// ---------------------------------------------------------------------------
function makeSafe(string, slugifyFn, collisionSuffix) {
  var key = slugifyFn(string);
  if (!headingIds[key]) {
    headingIds[key] = 0;
  }
  headingIds[key]++;
  if (headingIds[key] > 1) {
    return key + (collisionSuffix ? '-' + collisionSuffix + headingIds[key] : '-' + headingIds[key]);
  }
  return key;
}

// ---------------------------------------------------------------------------
// 从 TOC 树直接生成 HTML
// ---------------------------------------------------------------------------
function buildTocHtml(nodes, opts, indent, isRoot) {
  indent = indent || 0;
  if (!nodes || nodes.length === 0) return '';

  var classAttr = isRoot ? ' class="' + escAttr(opts.tocClassName) + '"' : '';
  var html = '\n<ul' + classAttr + '>\n';

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    for (var s = 0; s < indent + 1; s++) { html += '  '; }
    html += '<li>';
    if (node.heading && node.heading.content) {
      var label = node.heading.content.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
      html += '<a href="#' + escAttr(node.heading.anchor) + '">' + escHtml(label) + '</a>';
    }
    if (node.nodes && node.nodes.length > 0) {
      html += buildTocHtml(node.nodes, opts, indent + 1, false);
    }
    html += '</li>\n';
  }

  for (var s2 = 0; s2 < indent; s2++) { html += '  '; }
  html += '</ul>';
  return html;
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// 主插件函数
// ---------------------------------------------------------------------------
module.exports = function(md, opts) {
  // 通过解析一个空占位符获取 Token 构造函数（markdown-it v14 不直接导出 Token）
  var placeholder = md.parse('_', {});
  var Token = placeholder[0] ? placeholder[0].constructor : null;

  opts = Object.assign({
    // ---- TOC 目录生成（默认关闭，由上层传入 opts.toc 显式开启） ----
    toc: false,
    tocClassName: 'toc',
    tocFirstLevel: 1,
    tocLastLevel: 6,
    tocCallback: null,

    // ---- 标题锚点 ID ----
    level: 2,
    collisionSuffix: '',
    anchorLinkPrefix: '',
    case: 0,
    separator: '-',
    slugify: null,
    resetIds: true,

    // ---- 锚点链接符号 ----
    anchorLink: false,
    anchorLinkSymbol: '#',
    anchorLinkBefore: true,
    anchorClassName: 'anchor',
    anchorLinkSpace: true,
    anchorLinkSymbolClassName: null,
    wrapHeadingTextInAnchor: false,
  }, opts);

  // 兼容 anchors.js 的 permalink 选项命名
  if (opts.permalink != null && opts.anchorLink === false) {
    opts.anchorLink = opts.permalink;
  }
  if (opts.permalinkSymbol != null && opts.anchorLinkSymbol === '#') {
    opts.anchorLinkSymbol = opts.permalinkSymbol;
  }
  if (opts.permalinkClass != null && opts.anchorClassName === 'anchor') {
    opts.anchorClassName = opts.permalinkClass;
  }

  // slug 生成函数
  var slugOpts = { transform: opts.case, separator: opts.separator || '-' };
  var slugifyFn = typeof opts.slugify === 'function'
    ? opts.slugify
    : function(s) { return slugize(s, slugOpts); };

  // 重置全局状态
  headingIds = {};
  tocHtml = '';

  // -----------------------------------------------------------------------
  // 在标题旁插入锚点链接符号
  // -----------------------------------------------------------------------
  function renderAnchorLink(anchor, tokens, idx) {
    var attrs = [];
    if (opts.anchorClassName != null) {
      attrs.push(['class', opts.anchorClassName]);
    }
    attrs.push(['href', '#' + anchor]);

    if (opts.wrapHeadingTextInAnchor) {
      var openLink = Object.assign(new Token('link_open', 'a', 1), { attrs: attrs });
      var closeLink = new Token('link_close', 'a', -1);
      tokens[idx + 1].children.unshift(openLink);
      tokens[idx + 1].children.push(closeLink);
      return;
    }

    var symbolTokens = [];
    if (opts.anchorLinkSymbolClassName) {
      symbolTokens.push(
        Object.assign(new Token('span_open', 'span', 1), {
          attrs: [['class', opts.anchorLinkSymbolClassName]]
        }),
        Object.assign(new Token('text', '', 0), {
          content: opts.anchorLinkSymbol
        }),
        new Token('span_close', 'span', -1)
      );
    } else {
      symbolTokens.push(
        Object.assign(new Token('text', '', 0), {
          content: opts.anchorLinkSymbol
        })
      );
    }

    var linkTokens = [
      Object.assign(new Token('link_open', 'a', 1), { attrs: attrs }),
      symbolTokens[0]
    ];

    for (var si = 1; si < symbolTokens.length; si++) {
      linkTokens.push(symbolTokens[si]);
    }
    linkTokens.push(new Token('link_close', 'a', -1));

    if (opts.anchorLinkSpace) {
      var space = Object.assign(new Token('text', '', 0), { content: ' ' });
      if (opts.anchorLinkBefore) {
        linkTokens.push(space);
      } else {
        linkTokens.unshift(space);
      }
    }

    var method = opts.anchorLinkBefore ? 'unshift' : 'push';
    var children = tokens[idx + 1].children;
    for (var li = linkTokens.length - 1; li >= 0; li--) {
      if (method === 'unshift') {
        children.unshift(linkTokens[li]);
      } else {
        children.push(linkTokens[li]);
      }
    }
  }

  // ===================================================================
  // Core Rule: 收集所有标题 → 生成 TOC → 设置 _tocAnchor
  // ===================================================================
  md.core.ruler.push('init_toc', function(state) {
    if (opts.resetIds) {
      headingIds = {};
    }

    var tocArray = [];
    var tokens = state.tokens;

    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'heading_close') continue;

      var heading = tokens[i - 1];
      var heading_close = tokens[i];
      var hLevel = +heading_close.tag.substr(1);

      if (heading.type !== 'inline') continue;

      var inTocRange = opts.toc && hLevel >= opts.tocFirstLevel && hLevel <= opts.tocLastLevel;
      var needsAnchor = inTocRange || hLevel >= opts.level;

      if (!needsAnchor) continue;

      var content;
      var anchor;

      if (
        heading.children &&
        heading.children.length > 0 &&
        heading.children[0].type === 'link_open'
      ) {
        content = heading.children[1].content;
      } else {
        content = heading.children.reduce(function(acc, t) { return acc + t.content; }, '');
      }

      anchor = makeSafe(content, slugifyFn, opts.collisionSuffix);

      if (opts.anchorLinkPrefix) {
        anchor = opts.anchorLinkPrefix + anchor;
      }

      heading._tocAnchor = anchor;

      if (inTocRange) {
        tocArray.push({ content: content, anchor: anchor, level: hLevel });
      }
    }

    if (opts.toc && tocArray.length > 0) {
      var tree = { nodes: [] };
      tocArray.forEach(function(item) {
        var depth = 1;
        var lastItem = tree;
        for (; depth < item.level - opts.tocFirstLevel + 1; depth++) {
          if (lastItem.nodes.length === 0) {
            lastItem.nodes.push({ heading: {}, nodes: [] });
          }
          lastItem = lastItem.nodes[lastItem.nodes.length - 1];
        }
        lastItem.nodes.push({ heading: item, nodes: [] });
      });

      tocHtml = buildTocHtml(tree.nodes, opts, 0, true);
    } else {
      tocHtml = '';
    }

    if (typeof state.env.tocCallback === 'function') {
      state.env.tocCallback.call(undefined, tocArray, tocHtml);
    } else if (typeof opts.tocCallback === 'function') {
      opts.tocCallback.call(undefined, tocArray, tocHtml);
    }
  });

  // ===================================================================
  // Block Rule: 检测独立成行的 @[toc]
  // ===================================================================
  md.block.ruler.before('paragraph', 'toc_block', function(state, startLine, endLine, silent) {
    if (!opts.toc) return false;

    var pos = state.bMarks[startLine] + state.tShift[startLine];
    var max = state.eMarks[startLine];

    if (pos + 6 > max) return false;
    if (state.src.charCodeAt(pos) !== 0x40) return false;
    if (state.src.charCodeAt(pos + 1) !== 0x5b) return false;

    var match = TOC_RE.exec(state.src.slice(pos, max));
    if (!match) return false;

    if (silent) return true;

    var token = state.push('toc_open', 'toc', 1);
    token.map = [startLine, startLine + 1];

    state.push('toc_body', '', 0);
    state.push('toc_close', 'toc', -1);

    state.line = startLine + 1;
    return true;
  });

  // ===================================================================
  // Inline Rule: 检测段落内的 @[toc]（兼容 inline 用法）
  // ===================================================================
  md.inline.ruler.after('emphasis', 'toc', function(state, silent) {
    if (!opts.toc) return false;

    if (state.src.charCodeAt(state.pos) !== 0x40 ||
        state.src.charCodeAt(state.pos + 1) !== 0x5b ||
        silent) {
      return false;
    }

    var match = TOC_RE.exec(state.src.slice(state.pos));
    if (!match) return false;

    state.push('toc_open', 'toc', 1);
    state.push('toc_body', '', 0);
    state.push('toc_close', 'toc', -1);

    state.pos += 6;
    return true;
  });

  // ===================================================================
  // Renderer Rule: heading_open（设置标题 id）
  // ===================================================================
  var originalHeadingOpen = md.renderer.rules.heading_open;

  md.renderer.rules.heading_open = function(tokens, idx, options, env, self) {
    var hLevel = +tokens[idx].tag.substr(1);

    var inTocRange = opts.toc && hLevel >= opts.tocFirstLevel && hLevel <= opts.tocLastLevel;
    var needsAnchor = inTocRange || hLevel >= opts.level;

    if (needsAnchor) {
      var anchor = tokens[idx + 1]._tocAnchor;
      if (!anchor) {
        var content = tokens[idx + 1].children.reduce(function(acc, t) { return acc + t.content; }, '');
        anchor = makeSafe(content, slugifyFn, opts.collisionSuffix);
      }

      var attrs = tokens[idx].attrs || (tokens[idx].attrs = []);
      attrs.push(['id', anchor]);

      if (opts.anchorLink) {
        renderAnchorLink(anchor, tokens, idx);
      }
    }

    if (originalHeadingOpen) {
      return originalHeadingOpen.apply(this, arguments);
    }
    return self.renderToken(tokens, idx, options);
  };

  // ===================================================================
  // Renderer Rule: TOC 占位 token
  // ===================================================================
  md.renderer.rules.toc_open = function() { return ''; };
  md.renderer.rules.toc_close = function() { return ''; };
  md.renderer.rules.toc_body = function() {
    return opts.toc ? tocHtml : '';
  };
};
