// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/vue'
import sharedDomPurify from 'dompurify'
import { defineComponent, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import SanitizedHtml from './SanitizedHtml.vue'

const renderHtml = (html: string, compatibilityMode = false) =>
  render(SanitizedHtml, {
    props: { as: 'span', compatibilityMode, html },
    attrs: { 'data-testid': 'sanitized-html' }
  })

const rendered = () => screen.getByTestId('sanitized-html').innerHTML

describe('SanitizedHtml', () => {
  it('preserves safe markup while removing executable content', () => {
    renderHtml(
      [
        '<strong>Safe content</strong>',
        '<a id="safe-link" href="https://example.com" target="_blank">safe link</a>',
        '<a id="unsafe-link" href="javascript:alert(1)">unsafe link</a>',
        '<img src="x" alt="unsafe image" onerror="alert(1)">',
        '<script>alert(1)</script>'
      ].join('')
    )

    expect(screen.getByTestId('sanitized-html')).toBeInTheDocument()
    expect(
      screen.getByText('Safe content', { selector: 'strong' })
    ).toBeVisible()
    expect(screen.getByText('unsafe link')).not.toHaveAttribute('href')
    expect(screen.getByRole('link', { name: 'safe link' })).toHaveAttribute(
      'target',
      '_blank'
    )
    expect(screen.getByRole('link', { name: 'safe link' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
    expect(
      screen.getByRole('img', { name: 'unsafe image' })
    ).not.toHaveAttribute('onerror')
    expect(screen.queryByText('alert(1)')).not.toBeInTheDocument()
  })

  describe('extension compatibility rollout', () => {
    afterEach(() => {
      localStorage.removeItem('ff:strict_extension_rich_text_enabled')
    })

    it('preserves safe presentation metadata while removing executable content', () => {
      renderHtml(
        '<div class="extension-callout" style="color: red">Safe</div><a href="https://example.com" target="_blank">Link</a><script>alert(1)</script>',
        true
      )

      expect(screen.getByText('Safe')).toHaveAttribute(
        'class',
        'extension-callout'
      )
      expect(screen.getByText('Safe')).toHaveAttribute('style', 'color: red')
      expect(screen.queryByText('alert(1)')).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute(
        'rel',
        'noopener noreferrer'
      )
    })

    it('enables the strict policy through the rollout flag', () => {
      localStorage.setItem('ff:strict_extension_rich_text_enabled', 'true')
      renderHtml(
        '<div class="extension-callout" style="color: red">Safe</div>',
        true
      )

      expect(screen.getByText('Safe').getAttributeNames()).toEqual([])
    })
  })

  describe('tag allowlist', () => {
    it('strips unsupported and interactive tags', () => {
      const blocked = [
        ['audio', '<audio src="https://evil.example/audio.mp3"></audio>'],
        ['canvas', '<canvas>fallback</canvas>'],
        ['dialog', '<dialog open>overlay</dialog>'],
        [
          'form',
          '<form action="https://evil.example"><input name="pw"></form>'
        ],
        ['input', '<input type="password" name="pw">'],
        ['button', '<button formaction="https://evil.example">go</button>'],
        ['textarea', '<textarea>text</textarea>'],
        ['select', '<select><option>one</option></select>'],
        ['style', '<style>body{display:none}</style>'],
        ['iframe', '<iframe src="https://evil.example"></iframe>'],
        ['object', '<object data="https://evil.example"></object>'],
        ['embed', '<embed src="https://evil.example">'],
        ['base', '<base href="https://evil.example/">'],
        ['meta', '<meta http-equiv="refresh" content="0;url=https://evil">']
      ]

      for (const [tag, html] of blocked) {
        cleanup()
        renderHtml(html)
        expect(rendered()).not.toContain(`<${tag}`)
      }
    })

    it('keeps the tags markdown rendering needs', () => {
      const allowed = [
        ['p', '<p>paragraph</p>'],
        ['h2', '<h2>heading</h2>'],
        ['ul', '<ul><li>item</li></ul>'],
        ['pre', '<pre><code>code</code></pre>'],
        ['table', '<table><tbody><tr><td>cell</td></tr></tbody></table>'],
        ['blockquote', '<blockquote>quote</blockquote>'],
        ['img', '<img src="https://example.com/a.png" alt="a">']
      ]

      for (const [tag, html] of allowed) {
        cleanup()
        renderHtml(html)
        expect(rendered()).toContain(`<${tag}`)
      }
    })

    it('preserves safe structural markup accepted before the boundary', () => {
      renderHtml(
        '<div><figure><figcaption>caption</figcaption></figure><table><caption>table caption</caption><tfoot><tr><td>footer</td></tr></tfoot></table><dl><dt>Term</dt><dd>Definition</dd></dl><p><q>Quote</q><cite>Source</cite><ins>added</ins><kbd>Ctrl</kbd><sub>2</sub><sup>3</sup></p></div>'
      )

      expect(
        screen.getByText('caption', {
          selector: 'div > figure > figcaption'
        })
      ).toBeVisible()
      expect(
        screen.getByText('table caption', { selector: 'table > caption' })
      ).toBeVisible()
      expect(
        screen.getByText('footer', { selector: 'table > tfoot td' })
      ).toBeVisible()
      expect(screen.getByText('Term', { selector: 'dl > dt' })).toBeVisible()
      expect(
        screen.getByText('Definition', { selector: 'dl > dd' })
      ).toBeVisible()
      expect(screen.getByText('Quote', { selector: 'q' })).toBeVisible()
      expect(screen.getByText('Source', { selector: 'cite' })).toBeVisible()
      expect(screen.getByText('added', { selector: 'ins' })).toBeVisible()
      expect(screen.getByText('Ctrl', { selector: 'kbd' })).toBeVisible()
      expect(screen.getByText('2', { selector: 'sub' })).toBeVisible()
      expect(screen.getByText('3', { selector: 'sup' })).toBeVisible()
    })

    it('preserves safe inline markup accepted before the boundary', () => {
      renderHtml(
        '<p><abbr title="HyperText Markup Language">HTML</abbr> <b>bold</b> <i>italic</i> <u>underlined</u> <s>obsolete</s> <mark>highlighted</mark> <small>fine print</small></p>'
      )

      expect(screen.getByText('HTML', { selector: 'abbr' })).toHaveAttribute(
        'title',
        'HyperText Markup Language'
      )
      expect(screen.getByText('bold', { selector: 'b' })).toBeVisible()
      expect(screen.getByText('italic', { selector: 'i' })).toBeVisible()
      expect(screen.getByText('underlined', { selector: 'u' })).toBeVisible()
      expect(screen.getByText('obsolete', { selector: 's' })).toBeVisible()
      expect(
        screen.getByText('highlighted', { selector: 'mark' })
      ).toBeVisible()
      expect(
        screen.getByText('fine print', { selector: 'small' })
      ).toBeVisible()
    })

    it('preserves safe raw HTML accepted by the markdown renderer', () => {
      renderHtml(
        renderMarkdownToHtml(
          '<details open><summary>More</summary><section><time datetime="2026-08-24">Today</time></section></details>'
        )
      )

      expect(screen.getByRole('group')).toHaveAttribute('open')
      expect(screen.getByText('More', { selector: 'summary' })).toBeVisible()
      expect(screen.getByText('Today', { selector: 'time' })).toHaveAttribute(
        'datetime',
        '2026-08-24'
      )
    })

    it('removes presentation metadata from markdown producer output', () => {
      renderHtml(
        renderMarkdownToHtml(
          '<p class="release-callout" style="color: red">Release content</p>'
        )
      )

      const content = screen.getByText('Release content', { selector: 'p' })
      expect(content.getAttributeNames()).toEqual([])
      expect(content).toBeVisible()
    })

    it('preserves supported video markup from the markdown renderer', () => {
      renderHtml(
        renderMarkdownToHtml(
          '<video aria-label="Sample video" src="video.mp4" controls autoplay loop muted preload="metadata" poster="poster.png"><source src="video.webm" type="video/webm"></video>'
        )
      )

      const video = screen.getByLabelText('Sample video')
      expect(video).toHaveAttribute('src', 'video.mp4')
      expect(video).toHaveAttribute('controls')
      expect(video).toHaveAttribute('autoplay')
      expect(video).toHaveAttribute('loop')
      expect(video).toHaveAttribute('muted')
      expect(video).toHaveAttribute('preload', 'metadata')
      expect(video).toHaveAttribute('poster', 'poster.png')
      expect(rendered()).toContain(
        '<source src="video.webm" type="video/webm">'
      )
    })

    it('preserves responsive picture sources from the markdown renderer', () => {
      renderHtml(
        renderMarkdownToHtml(
          '<picture><source media="(min-width: 800px)" srcset="small.webp 1x, large.webp 2x" sizes="(max-width: 600px) 100vw, 600px"><img src="large.webp" alt="Example image"></picture><div media="all">Text</div>'
        )
      )

      expect(rendered()).toContain('media="(min-width: 800px)"')
      expect(rendered()).toContain('srcset="small.webp 1x, large.webp 2x"')
      expect(rendered()).toContain('sizes="(max-width: 600px) 100vw, 600px"')
      expect(
        screen.getByRole('img', { name: 'Example image' })
      ).toHaveAttribute('src', 'large.webp')
      expect(screen.getByText('Text')).not.toHaveAttribute('media')
    })

    it('preserves only inert task-list checkboxes from the markdown renderer', () => {
      renderHtml(renderMarkdownToHtml('- [x] done\n- [ ] todo'))

      const checkboxes = screen.getAllByRole('checkbox')
      expect(screen.getByRole('list')).toHaveClass('contains-task-list')
      for (const item of screen.getAllByRole('listitem')) {
        expect(item).toHaveClass('task-list-item')
      }
      expect(checkboxes).toHaveLength(2)
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
      for (const checkbox of checkboxes) {
        expect(checkbox).toBeDisabled()
      }
      expect(checkboxes[0].getAttributeNames().sort()).toEqual([
        'checked',
        'disabled',
        'type'
      ])
      expect(checkboxes[1].getAttributeNames().sort()).toEqual([
        'disabled',
        'type'
      ])

      cleanup()
      renderHtml(renderMarkdownToHtml('1. [ ] todo'))
      expect(screen.getByRole('list')).toHaveClass('contains-task-list')
      expect(screen.getByRole('listitem')).toHaveClass('task-list-item')
      expect(screen.getByRole('checkbox')).toBeDisabled()

      cleanup()
      renderHtml('<input type="CHECKBOX" disabled checked>')
      const mixedCaseCheckbox = screen.getByRole('checkbox')
      expect(mixedCaseCheckbox).toBeChecked()
      expect(mixedCaseCheckbox).toBeDisabled()
      expect(mixedCaseCheckbox.getAttributeNames().sort()).toEqual([
        'checked',
        'disabled',
        'type'
      ])

      cleanup()
      renderHtml('<input type="checkbox" checked>')
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('preserves only code-fence language metadata from the markdown renderer', () => {
      renderHtml(renderMarkdownToHtml('```typescript\nconst ready = true\n```'))

      expect([
        ...screen.getByText('const ready = true', { selector: 'code' })
          .classList
      ]).toEqual(['language-typescript'])

      cleanup()
      renderHtml('<code class="language-js fixed">code</code>')
      expect([...screen.getByText('code').classList]).toEqual(['language-js'])
    })
  })

  describe('target hardening', () => {
    it('adds rel to a non-_blank target, not just _blank', () => {
      renderHtml('<a href="https://example.com" target="pwn">named</a>')
      const link = screen.getByRole('link', { name: 'named' })
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('preserves an existing rel while adding noopener and noreferrer', () => {
      renderHtml(
        '<a href="https://example.com" target="_blank" rel="nofollow">x</a>'
      )
      const rel = screen.getByRole('link', { name: 'x' }).getAttribute('rel')
      expect(rel?.split(' ').sort()).toEqual([
        'nofollow',
        'noopener',
        'noreferrer'
      ])
    })
  })

  it('strips styling that could create an application overlay', () => {
    renderHtml(
      '<div class="fixed inset-0 z-2000" style="position:fixed;inset:0;z-index:9999">overlay</div>'
    )
    expect(rendered()).toContain('overlay')
    expect(rendered()).not.toContain('class=')
    expect(rendered()).not.toContain('position:fixed')
    expect(rendered()).not.toContain('style=')
  })

  it('preserves supported attributes and strips layout controls', () => {
    renderHtml(
      [
        '<a href="https://example.com" target="_blank" title="Example" aria-label="Example link" align="center" data-layout="wide">link</a>',
        '<img src="image.png" alt="Example image" title="Image" width="100000" height="100000" align="left" bgcolor="red">',
        '<video aria-label="Example video" src="video.mp4" controls autoplay loop muted preload="metadata" poster="poster.png" width="100000" height="100000"><source src="video.webm" type="video/webm" media="all"></video>'
      ].join('')
    )

    expect(
      screen
        .getByRole('link', { name: 'Example link' })
        .getAttributeNames()
        .sort()
    ).toEqual(['aria-label', 'href', 'rel', 'target', 'title'])
    expect(
      screen
        .getByRole('img', { name: 'Example image' })
        .getAttributeNames()
        .sort()
    ).toEqual(['alt', 'src', 'title'])

    const video = screen.getByLabelText('Example video')
    expect(video.getAttributeNames().sort()).toEqual([
      'aria-label',
      'autoplay',
      'controls',
      'loop',
      'muted',
      'poster',
      'preload',
      'src'
    ])
    expect(rendered()).toContain(
      '<source src="video.webm" type="video/webm" media="all">'
    )
  })

  it('preserves fragment targets and audited ARIA relationships', () => {
    renderHtml(
      [
        '<a href="#install" aria-describedby="install-help" aria-controls="install-panel" aria-expanded="false">Install</a>',
        '<h2 id="install" aria-labelledby="install-title"><span id="install-title">Install heading</span></h2>',
        '<p id="install-help" aria-live="polite">Installation help</p>',
        '<div id="install-panel" aria-hidden="true">Installation panel</div>',
        '<span aria-unknown="value">Unknown ARIA</span>'
      ].join('')
    )

    const link = screen.getByRole('link', { name: 'Install' })
    expect(link).toHaveAttribute('href', '#install')
    expect(link).toHaveAttribute('aria-describedby', 'install-help')
    expect(link).toHaveAttribute('aria-controls', 'install-panel')
    expect(link).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading')).toHaveAttribute('id', 'install')
    expect(screen.getByRole('heading')).toHaveAttribute(
      'aria-labelledby',
      'install-title'
    )
    expect(screen.getByText('Installation help')).toHaveAttribute(
      'aria-live',
      'polite'
    )
    expect(screen.getByText('Installation panel')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.getByText('Unknown ARIA')).not.toHaveAttribute('aria-unknown')
  })

  it('preserves bounded list and table semantics', () => {
    renderHtml(
      '<ol start=" 5 " reversed><li value="7">Step</li></ol><table><colgroup span="2"><col span="2"></colgroup><thead><tr><th abbr="Short" scope="COL" colspan="2">Heading</th></tr></thead><tbody><tr><td rowspan="3">Cell</td></tr></tbody></table>'
    )

    const list = screen.getByRole('list')
    expect(list).toHaveAttribute('start', '5')
    expect(list).toHaveAttribute('reversed')
    expect(screen.getByRole('listitem')).toHaveAttribute('value', '7')
    expect(rendered()).toContain('<colgroup span="2"><col span="2">')
    expect(screen.getByRole('columnheader')).toHaveAttribute('abbr', 'Short')
    expect(screen.getByRole('columnheader')).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('columnheader')).toHaveAttribute('colspan', '2')
    expect(screen.getByRole('cell')).toHaveAttribute('rowspan', '3')

    cleanup()
    renderHtml(
      '<div start="5" reversed value="7" span="2" abbr="Wrong">Text</div><table><colgroup span="1001"><col span="invalid"></colgroup><tbody><tr><td colspan="1001" rowspan="65535" scope="row" abbr="Wrong">Cell</td></tr></tbody></table><ol start="invalid"><li value="invalid">Step</li></ol>'
    )

    expect(screen.getByText('Text')).not.toHaveAttribute('start')
    expect(screen.getByText('Text')).not.toHaveAttribute('reversed')
    expect(screen.getByText('Text')).not.toHaveAttribute('value')
    expect(screen.getByText('Text')).not.toHaveAttribute('span')
    expect(screen.getByText('Text')).not.toHaveAttribute('abbr')
    expect(screen.getByRole('cell')).not.toHaveAttribute('colspan')
    expect(screen.getByRole('cell')).not.toHaveAttribute('rowspan')
    expect(screen.getByRole('cell')).not.toHaveAttribute('scope')
    expect(screen.getByRole('cell')).not.toHaveAttribute('abbr')
    expect(screen.getByRole('list')).not.toHaveAttribute('start')
    expect(screen.getByRole('listitem')).not.toHaveAttribute('value')
    expect(rendered()).not.toContain('<colgroup span=')
    expect(rendered()).not.toContain('<col span=')
  })

  it('preserves tag-scoped data and measurement semantics', () => {
    renderHtml(
      '<data value="sku-1">Product</data><meter min="0" max="1" low=".25" high=".75" optimum=".5" value=".6">Score</meter><progress max="100" value="50">Progress</progress>'
    )

    expect(screen.getByText('Product', { selector: 'data' })).toHaveAttribute(
      'value',
      'sku-1'
    )
    expect(
      screen
        .getByText('Score', { selector: 'meter' })
        .getAttributeNames()
        .sort()
    ).toEqual(['high', 'low', 'max', 'min', 'optimum', 'value'])
    expect(screen.getByText('Score', { selector: 'meter' })).toHaveAttribute(
      'value',
      '.6'
    )
    expect(
      screen.getByText('Progress', { selector: 'progress' })
    ).toHaveAttribute('max', '100')
    expect(
      screen.getByText('Progress', { selector: 'progress' })
    ).toHaveAttribute('value', '50')

    cleanup()
    renderHtml(
      '<div value="1" min="0" max="1" low=".25" high=".75" optimum=".5">Text</div><progress min="0" low=".25" high=".75" optimum=".5">Progress</progress>'
    )

    expect(screen.getByText('Text').getAttributeNames()).toEqual([])
    expect(screen.getByText('Progress').getAttributeNames()).toEqual([])
  })

  it('falls back to a safe container for an unsafe runtime tag', () => {
    render({
      components: { SanitizedHtml },
      template:
        '<SanitizedHtml as="style" html="body { display: none }" data-testid="sanitized-html" />'
    })

    expect(screen.getByTestId('sanitized-html').tagName).toBe('DIV')
  })

  it('updates fallthrough attributes', async () => {
    const wrapperClass = ref('before')
    const label = ref('before')

    render(
      defineComponent({
        components: { SanitizedHtml },
        setup: () => ({ label, wrapperClass }),
        template:
          '<SanitizedHtml :aria-label="label" :class="wrapperClass" data-testid="sanitized-html" html="safe" />'
      })
    )

    const container = screen.getByTestId('sanitized-html')
    expect(container).toHaveClass('before')
    expect(container).toHaveAttribute('aria-label', 'before')

    wrapperClass.value = 'after'
    label.value = 'after'
    await nextTick()

    expect(container).toHaveClass('after')
    expect(container).toHaveAttribute('aria-label', 'after')
  })

  describe('isolation from the shared DOMPurify singleton', () => {
    afterEach(() => {
      sharedDomPurify.removeAllHooks()
    })

    it('is unaffected by hooks added to the shared instance', () => {
      sharedDomPurify.addHook('uponSanitizeElement', (node) => {
        // A deliberately destructive hook: if the singleton were shared, this
        // would empty every element this component renders.
        if (node instanceof Element) node.remove()
      })

      renderHtml('<strong>still here</strong>')
      expect(rendered()).toContain('still here')
    })
  })

  describe('degenerate input', () => {
    it('renders malformed markup without throwing', () => {
      const inputs = [
        ['empty string', ''],
        ['whitespace', '   '],
        ['plain text', 'just text'],
        ['unclosed tag', '<strong>unclosed'],
        ['stray closing tag', 'text</div>'],
        ['bare angle bracket', 'a < b'],
        ['nested unclosed', '<div><span>deep']
      ]

      for (const [, html] of inputs) {
        cleanup()
        expect(() => renderHtml(html)).not.toThrow()
      }
    })

    it('neutralises mutation and encoding payloads', () => {
      const payloads = [
        {
          html: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
          forbiddenContent: ['onerror', 'alert(1)']
        },
        {
          html: '<svg><foreignObject><p>x</p></foreignObject></svg>',
          forbiddenContent: ['<svg']
        },
        {
          html: '<math><annotation-xml encoding="text/html"><p>x</p></annotation-xml></math>',
          forbiddenContent: ['<math']
        },
        {
          html: '<img src=x onerror=&#97;lert(1)>',
          forbiddenContent: ['onerror', 'alert(1)']
        },
        {
          html: '<img src=x OnErRoR=alert(1)>',
          forbiddenContent: ['onerror', 'alert(1)']
        }
      ]

      for (const { html, forbiddenContent } of payloads) {
        cleanup()
        renderHtml(html)
        for (const content of forbiddenContent) {
          expect(rendered()).not.toContain(content)
        }
      }
    })
  })
})
