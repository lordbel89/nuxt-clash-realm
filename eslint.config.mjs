// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      '@stylistic/comma-dangle': 'error',
      '@stylistic/semi': 'error',
      '@stylistic/eol-last': 'off',
      '@stylistic/member-delimiter-style': 'off',
      '@stylistic/arrow-parens': 'off',
      'vue/block-tag-newline': 'off',
      'vue/no-v-html': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/html-closing-bracket-newline': 'off',
    },
  },
)
