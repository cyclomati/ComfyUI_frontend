<template>
  <SanitizedContent v-bind="{ ...$attrs }" />
</template>

<script setup lang="ts">
import { default as createDOMPurify } from 'dompurify'
import { computed, defineComponent, h } from 'vue'

// Isolated instance: the shared singleton is mutated at import time by
// litegraph's ContextMenu, so the posture here would otherwise depend on
// module import order.
const purifier = createDOMPurify(window)

defineOptions({ inheritAttrs: false })

const SAFE_CONTAINER_TAGS = ['div', 'span'] as const
type SafeContainerTag = (typeof SAFE_CONTAINER_TAGS)[number]

const { html, as = 'div' } = defineProps<{
  html: string
  as?: SafeContainerTag
}>()

const ALLOWED_TAGS = [
  'a',
  'abbr',
  'acronym',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'big',
  'blink',
  'blockquote',
  'br',
  'caption',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'dd',
  'del',
  'details',
  'dfn',
  'dir',
  'div',
  'dl',
  'dt',
  'em',
  'fieldset',
  'figcaption',
  'figure',
  'font',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'legend',
  'li',
  'main',
  'mark',
  'marquee',
  'menu',
  'meter',
  'nav',
  'nobr',
  'ol',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'search',
  'section',
  'small',
  'source',
  'spacer',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tfoot',
  'time',
  'tr',
  'track',
  'tt',
  'u',
  'ul',
  'var',
  'video',
  'wbr'
]

const ALLOWED_ATTR = [
  'abbr',
  'alt',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-expanded',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'aria-live',
  'autoplay',
  'checked',
  'cite',
  'class',
  'colspan',
  'controls',
  'datetime',
  'default',
  'disabled',
  'high',
  'href',
  'id',
  'kind',
  'label',
  'low',
  'loop',
  'max',
  'media',
  'min',
  'muted',
  'open',
  'optimum',
  'poster',
  'preload',
  'rel',
  'reversed',
  'role',
  'rowspan',
  'scope',
  'sizes',
  'span',
  'src',
  'srclang',
  'srcset',
  'start',
  'target',
  'title',
  'type',
  'value'
]

const sanitizedHtml = computed(() => {
  const fragment = purifier.sanitize(html, {
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    ALLOWED_ATTR,
    ALLOWED_TAGS,
    RETURN_DOM_FRAGMENT: true
  })

  for (const element of fragment.querySelectorAll('[class]')) {
    const languageClasses =
      element.tagName === 'CODE'
        ? [...element.classList].filter(
            (className) =>
              className.startsWith('language-') &&
              className.length > 'language-'.length
          )
        : []
    element.removeAttribute('class')
    if (languageClasses.length) element.classList.add(...languageClasses)
  }

  for (const element of fragment.querySelectorAll('[media]')) {
    if (element.tagName !== 'SOURCE') element.removeAttribute('media')
  }

  for (const element of fragment.querySelectorAll('input, [target]')) {
    if (element.tagName === 'INPUT') {
      if (
        element.getAttribute('type')?.toLowerCase() !== 'checkbox' ||
        !element.hasAttribute('disabled')
      ) {
        element.remove()
        continue
      }
      for (const attribute of [...element.attributes]) {
        if (!['checked', 'disabled', 'type'].includes(attribute.name)) {
          element.removeAttribute(attribute.name)
        }
      }
      const listItem = element.parentElement
      if (listItem?.tagName === 'LI') {
        listItem.classList.add('task-list-item')
        const list = listItem.parentElement
        if (list?.tagName === 'OL' || list?.tagName === 'UL') {
          list.classList.add('contains-task-list')
        }
      }
      continue
    }

    if (element.hasAttribute('target')) {
      const rel = new Set((element.getAttribute('rel') ?? '').split(/\s+/))
      rel.delete('')
      rel.add('noopener')
      rel.add('noreferrer')
      element.setAttribute('rel', [...rel].join(' '))
    }
  }

  for (const element of fragment.querySelectorAll(
    '[start], [reversed], [value], [min], [max], [low], [high], [optimum], [colspan], [rowspan], [scope], [span], [abbr]'
  )) {
    if (element.tagName !== 'OL') {
      element.removeAttribute('start')
    } else {
      normalizeIntegerAttribute(element, 'start', -2147483648, 2147483647)
    }
    if (element.tagName !== 'OL') element.removeAttribute('reversed')
    if (element.tagName === 'LI') {
      normalizeIntegerAttribute(element, 'value', -2147483648, 2147483647)
    } else if (!['DATA', 'METER', 'PROGRESS'].includes(element.tagName)) {
      element.removeAttribute('value')
    }

    for (const attribute of ['min', 'max', 'low', 'high', 'optimum']) {
      if (
        element.tagName !== 'METER' &&
        (element.tagName !== 'PROGRESS' || attribute !== 'max')
      ) {
        element.removeAttribute(attribute)
      }
    }

    const isTableCell = element.tagName === 'TD' || element.tagName === 'TH'
    if (!isTableCell) {
      element.removeAttribute('colspan')
    } else {
      normalizeIntegerAttribute(element, 'colspan', 1, 1000)
    }
    if (!isTableCell) {
      element.removeAttribute('rowspan')
    } else {
      normalizeIntegerAttribute(element, 'rowspan', 0, 65534)
    }

    const scope = element.getAttribute('scope')?.toLowerCase()
    if (
      element.tagName !== 'TH' ||
      !scope ||
      !['col', 'colgroup', 'row', 'rowgroup'].includes(scope)
    ) {
      element.removeAttribute('scope')
    } else {
      element.setAttribute('scope', scope)
    }
    if (element.tagName !== 'TH') element.removeAttribute('abbr')

    if (!['COL', 'COLGROUP'].includes(element.tagName)) {
      element.removeAttribute('span')
    } else {
      normalizeIntegerAttribute(element, 'span', 1, 1000)
    }
  }

  const container = document.createElement('div')
  container.append(fragment)
  return container.innerHTML
})

function normalizeIntegerAttribute(
  element: Element,
  attribute: string,
  min: number,
  max: number
) {
  const integer = element.getAttribute(attribute)?.trim()
  const number = Number(integer)
  if (
    !integer ||
    !/^[+-]?\d+$/.test(integer) ||
    !Number.isSafeInteger(number) ||
    number < min ||
    number > max
  ) {
    element.removeAttribute(attribute)
    return
  }
  element.setAttribute(attribute, String(number))
}

const SanitizedContent = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => {
      const containerTag = SAFE_CONTAINER_TAGS.includes(as) ? as : 'div'
      return h(containerTag, { ...attrs, innerHTML: sanitizedHtml.value })
    }
  }
})
</script>
