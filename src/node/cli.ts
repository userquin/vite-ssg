/* eslint-disable no-unused-expressions */
import yargs from 'yargs'
import { readJSON } from 'fs-extra'
import { build } from './build'

yargs
  .scriptName('vite-ssg')
  .usage('$0 [args]')
  .command(
    'build',
    'Build SSG',
    args => args
      .option('script', {
        choices: ['sync', 'async', 'defer', 'async defer'] as const,
        describe: 'Rewrites script loading timing',
      })
      .option('mock', {
        type: 'boolean',
        describe: 'Mock browser globals (window, document, etc.) for SSG',
      })
      .option('i18n', {
        type: 'string',
        describe: 'I18n JSON configuration file for SSG',
      })
      .option('i18n', {
        type: 'string',
        describe: 'I18n configuration file (JSON) for SSG',
      }),
    async(args) => {
      if (args.i18n)
        args.i18nOptions = await readJSON(args.i18n)

      await build(args)
    },
  )
  .showHelpOnFail(false)
  .help()
  .argv
