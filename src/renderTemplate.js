'use strict'

const handlebars = require('handlebars')
const _ = require('lodash')
const fs = require('fs')
const { resolve } = require('path')
const { readdir } = require('fs').promises

async function* getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* getFiles(res)
    } else {
      yield res
    }
  }
}

function renderType(type) {
  if (type.kind === 'NON_NULL') {
    return renderType(type.ofType) + '!'
  }
  if (type.kind === 'LIST') {
    return `++[++${renderType(type.ofType)}++]++`
  }
  return `${type.name}`
}

async function renderSchema(schema, options) {
  const language = options.language || 'asciidoc'
  const layout = options.layout || 'main'

  const partialsDir = `${__dirname}/${language}/partials`
  const layoutDir = `${__dirname}/${language}/layouts`

  for await (const fileName of getFiles(partialsDir)) {
    const matches = /([\w-]+).hbs$/.exec(fileName)
    if (!matches) {
      return
    }
    const name = matches[1]
    const template = fs.readFileSync(fileName, 'utf8')
    handlebars.registerPartial(name, template)
  }
  handlebars.registerHelper('findType', function(collection, value) {
    return _.find(collection, it => it.name === value)
  })
  handlebars.registerHelper('findObjects', function(root) {
    return _.filter(
      root.types,
      it =>
        it.kind === 'OBJECT' &&
        !it.name.startsWith('__') &&
        (root.queryType == null || it.name !== root.queryType.name) &&
        (root.mutationType == null || it.name !== root.mutationType.name) &&
        (root.subscriptionType == null ||
          it.name !== root.subscriptionType.name)
    )
  })
  handlebars.registerHelper('hasObjects', function(root) {
    return (
      _.filter(
        root.types,
        it =>
          it.kind === 'OBJECT' &&
          !it.name.startsWith('__') &&
          (root.queryType == null || it.name !== root.queryType.name) &&
          (root.mutationType == null || it.name !== root.mutationType.name) &&
          (root.subscriptionType == null ||
            it.name !== root.subscriptionType.name)
      ).length > 0
    )
  })
  handlebars.registerHelper('filter', function(collection, field, value) {
    return _.filter(collection, it => it[field] === value)
  })
  handlebars.registerHelper('hasType', function(collection, value) {
    return _.filter(collection, it => it.kind === value).length > 0
  })
  handlebars.registerHelper('kind', renderType)

  const layoutFile = fs
    .readFileSync(`${layoutDir}/${layout}.hbs`, 'utf8')
    .toString()
  const template = handlebars.compile(layoutFile)
  return template(schema.__schema)
}

module.exports = renderSchema
