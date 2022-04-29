#!/usr/bin/env node
'use strict'

const parseArgs = require('minimist')
const resolveFrom = require('resolve-from')
const { loadSchemaJSON, schemaToJSON } = require('./loadSchemaJSON')
const renderSchema = require('./renderTemplate')
const fs = require('fs')

function safeExit(code) {
  process.on('exit', function() {
    process.exit(code)
  })
}

function printHelp(console) {
  const name = require('../package.json').name
  console.log(`
  Usage: ${name} [options] <schema>

  Output an asciidoc document with rendered descriptions and links between types.
  The schema may be specified as:

    - a URL to the GraphQL endpoint (the introspection query will be run)
    - a GraphQL document containing the schema (.graphql or .gql)
    - a JSON document containing the schema (as returned by the introspection query)
    - an importable module with the schema as its default export (either an instance
      of GraphQLSchema or a JSON object)
      
  Options:

    --language <string>    Sets the output language (default: 'asciidoc')
    --layout <string>      Sets the layout (default: 'main')
    --title <string>       Change the top heading title (default: 'Schema Types')
    --no-title             Do not print a default title
    --no-toc               Do not print table of contents
    --heading-level <num>  Heading level to begin at, useful if you are embedding the
                           output in a document with other sections (default: 1)
    --require <module>     If importing the schema from a module, require the specified
                           module first (useful for e.g. babel-register)
    --header <name=value>  Additional header(s) to use in GraphQL request
                           e.g. --header "Authorization=Bearer ey..."
    --version              Print version and exit
`)
}

function run(
  argv = process.argv.slice(2),
  { console = global.console, exit = true } = {}
) {
  const args = parseArgs(argv)

  if (args.help) {
    printHelp(console)
  } else if (args.version) {
    console.log(require('../package.json').version)
  } else if (args._.length === 1) {
    if (args.require) {
      const requirePath = resolveFrom('.', args.require)
      if (requirePath) {
        require(requirePath)
      } else {
        throw new Error(`Could not resolve --require module: ${args.require}`)
      }
    }
    const schemaPath = args._[0]
    const headers = [].concat(args['header'] || []).reduce((obj, header) => {
      const [key, ...value] = String(header).split('=')
      obj[key] = value.join('=')
      return obj
    }, {})
    const loadOptions = { headers }
    loadSchemaJSON(schemaPath, loadOptions).then(schema => {
      const options = {
        language: args.language,
        layout: args.layout,
        title: args.title,
        skipTitle: false,
        prologue: args.prologue,
        epilogue: args.epilogue,
        skipTableOfContents: args['toc'] === false,
        headingLevel: args['heading-level']
      }
      if (options.title === false) {
        options.title = ''
        options.skipTitle = true
      } else if (Array.isArray(options.title)) {
        options.title.forEach(value => {
          if (typeof value === 'string') {
            options.title = value
          } else if (value === false) {
            options.skipTitle = true
          }
        })
      }
      ;(async () => {
        const results = await renderSchema(schema, options)
        const buffer = Buffer.from(results)
        fs.writeFileSync('output/test.adoc', buffer)
      })()
      if (exit) {
        safeExit(0)
      }
    })
  } else {
    printHelp(console)
    if (exit) {
      safeExit(1)
    }
  }
}

module.exports = {
  run,
  loadSchemaJSON,
  schemaToJSON,
  renderSchema
}

if (require.main === module) {
  run()
}
