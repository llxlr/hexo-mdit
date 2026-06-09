'use strict';

// 综合测试脚本：验证 toc.js 所有功能
// 用法: node test/toc-test.js

var MarkdownIt = require('markdown-it');
var toc = require('../lib/renderer/markdown-it-toc-and-anchor');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name + ' — ' + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function contains(haystack, needle, msg) {
  assert(haystack.indexOf(needle) !== -1, msg || ('expected to contain: ' + needle));
}

function notContains(haystack, needle, msg) {
  assert(haystack.indexOf(needle) === -1, msg || ('should not contain: ' + needle));
}

// ===========================================================================
console.log('\n=== TOC 基本功能 ===\n');

test('检测 @[toc] 并生成目录', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    tocLastLevel: 6,
    level: 2,
    case: 0,
    separator: '-',
    anchorLink: false,
  });

  var result = md.render('@[toc]\n\n## 第一章\n\n内容\n\n## 第二章\n\n内容');
  contains(result, '<ul class="toc">', 'should have toc ul');
  contains(result, '<a href="#第一章">第一章</a>', 'should have link to 第一章');
  contains(result, '<a href="#第二章">第二章</a>', 'should have link to 第二章');
  contains(result, 'id="第一章"', 'should have heading id');
  contains(result, 'id="第二章"', 'should have heading id');
});

// ===========================================================================
console.log('\n=== 标题锚点链接 ===\n');

test('anchorLink 功能', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    anchorLink: true,
    anchorLinkSymbol: '#',
    anchorClassName: 'anchor',
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## 测试标题\n\n内容');
  contains(result, '<a class="anchor" href="#测试标题">#</a>', 'should have anchor link');
});

test('anchorLinkBefore: false', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocFirstLevel: 2,
    level: 2,
    anchorLink: true,
    anchorLinkSymbol: '#',
    anchorClassName: 'anchor',
    anchorLinkBefore: false,
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## 测试标题\n\n内容');
  contains(result, 'id="测试标题"', 'should have heading id');
  // 符号应该在标题后面
  var idx1 = result.indexOf('测试标题');
  var idx2 = result.indexOf('anchor');
  assert(idx1 < idx2, 'anchor link should be after heading text when anchorLinkBefore=false');
});

// ===========================================================================
console.log('\n=== 标题层级过滤 ===\n');

test('level: 3 过滤 h2', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    tocLastLevel: 4,
    level: 3,
    anchorLink: false,
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## h2标题\n\n内容\n\n### h3标题\n\n内容');
  // h2 在 TOC 范围 (tocFirstLevel=2) 内，必须有 id 保证目录链接有效
  contains(result, 'id="h2标题"', 'h2 should have id when in TOC range');
  contains(result, 'id="h3标题"', 'h3 should have id');
  contains(result, '<a href="#h2标题">', 'h2 should be in TOC');
  contains(result, '<a href="#h3标题">', 'h3 should be in TOC');
});

// ===========================================================================
console.log('\n=== 重复标题碰撞处理 ===\n');

test('重复标题自动添加后缀', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    anchorLink: false,
    collisionSuffix: '',
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## 相同标题\n\n内容\n\n## 相同标题\n\n内容');
  contains(result, 'id="相同标题"', 'first heading should have base id');
  contains(result, 'id="相同标题-2"', 'second heading should have -2 suffix');
  contains(result, '<a href="#相同标题-2">', 'TOC should link to suffixed anchor');
});

test('collisionSuffix 自定义后缀', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    anchorLink: false,
    collisionSuffix: 'v',
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## 标题\n\n内容\n\n## 标题\n\n内容');
  contains(result, 'id="标题-v2"', 'should use custom collision suffix');
});

// ===========================================================================
console.log('\n=== TOC 关闭 ===\n');

test('toc: false 不生成目录', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: false,
    level: 2,
    anchorLink: false,
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## 标题\n\n内容');
  // @[toc] 标记不会展开，但 heading 仍然有 id
  notContains(result, '<ul class="toc"', 'should not have TOC when disabled');
  contains(result, 'id="标题"', 'heading should still have id');
});

// ===========================================================================
console.log('\n=== slug 选项 ===\n');

test('case: 1 转小写', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    anchorLink: false,
    case: 1,  // lowercase
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## Hello WORLD\n\n内容');
  contains(result, 'id="hello-world"', 'should lowercase the slug');
});

test('separator 自定义', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    anchorLink: false,
    case: 0,
    separator: '_',
  });

  var result = md.render('@[toc]\n\n## hello world\n\n内容');
  contains(result, 'id="hello_world"', 'should use custom separator');
});

// ===========================================================================
console.log('\n=== tocFirstLevel / tocLastLevel ===\n');

test('tocFirstLevel: 3 只收集 h3 及以上', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 3,
    tocLastLevel: 4,
    level: 2,
    anchorLink: false,
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## h2标题\n\n内容\n\n### h3标题\n\n内容\n\n#### h4标题\n\n内容');
  // h2 不在 TOC 中 (tocFirstLevel=3)，但有 id (level=2)
  contains(result, 'id="h2标题"', 'h2 should have id');
  contains(result, 'id="h3标题"', 'h3 should have id');
  contains(result, 'id="h4标题"', 'h4 should have id');
  notContains(result, '<a href="#h2标题"', 'h2 should NOT be in TOC');
  contains(result, '<a href="#h3标题"', 'h3 should be in TOC');
  contains(result, '<a href="#h4标题"', 'h4 should be in TOC');
});

// ===========================================================================
console.log('\n=== tocCallback ===\n');

test('tocCallback 回调', function() {
  var cbArg = null;
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    anchorLink: false,
    case: 0,
    separator: '-',
    tocCallback: function(tocArray, html) {
      cbArg = { arr: tocArray, html: html };
    },
  });

  md.render('@[toc]\n\n## 标题一\n\n内容\n\n### 子标题\n\n内容');
  assert(cbArg !== null, 'callback should be called');
  assert(cbArg.arr.length === 2, 'should have 2 TOC entries');
  assert(cbArg.arr[0].content === '标题一', 'first entry should be 标题一');
  assert(cbArg.arr[1].content === '子标题', 'second entry should be 子标题');
});

// ===========================================================================
console.log('\n=== inline @[toc] 兼容 ===\n');

test('段落内的 @[toc] 也能生成目录', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    anchorLink: false,
    case: 0,
    separator: '-',
  });

  // inline @[toc] (not on its own line) - inline rule handles this
  var result = md.render('开头文字 @[toc] 结尾\n\n## 标题\n\n内容');
  contains(result, '<ul class="toc"', 'inline @[toc] should still generate TOC');
});

// ===========================================================================
console.log('\n=== permalink 兼容 anchors.js 选项名 ===\n');

test('permalink / permalinkClass 兼容', function() {
  var md = new MarkdownIt();
  md.use(toc, {
    toc: true,
    tocClassName: 'toc',
    tocFirstLevel: 2,
    level: 2,
    permalink: true,
    permalinkSymbol: '\u00b6',
    permalinkClass: 'header-anchor',
    case: 0,
    separator: '-',
  });

  var result = md.render('@[toc]\n\n## 标题\n\n内容');
  contains(result, 'class="header-anchor"', 'should use permalinkClass');
  contains(result, '\u00b6', 'should use permalinkSymbol');
});

// ===========================================================================
console.log('\n=== 结果: ' + passed + ' 通过, ' + failed + ' 失败 ===\n');

if (failed > 0) {
  process.exitCode = 1;
}
