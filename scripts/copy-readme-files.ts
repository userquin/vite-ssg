import { copyFileSync } from 'fs'

const destinations = [
  'multiple-pages',
  'multiple-pages-i18n',
  'multiple-pages-with-store',
]

destinations.map(ex => `examples/${ex}/README.md`).forEach((ex) => {
  copyFileSync('README.md', ex)
})
