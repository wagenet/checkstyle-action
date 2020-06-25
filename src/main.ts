import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs'
import * as path from 'path'
import {promisify} from 'util'
import * as xml from 'xml2js'

const readFile = promisify(fs.readFile)
const parseString = promisify(xml.parseString)

interface CheckstyleError {
  $: {
    line: string
    severity: string
    message: string
    column: string | undefined
  }
}

interface CheckstyleFile {
  $: {name: string}
  error: CheckstyleError[] | undefined
}

async function run(): Promise<void> {
  try {
    const rawFilesList = core.getInput('files')
    let filesList: string[] | null = null
    if (rawFilesList) {
      filesList = (JSON.parse(rawFilesList) as string[]).map(f =>
        path.resolve(f)
      )
    }

    const matchersPath = path.join(__dirname, '..', '.github')
    console.log(`##[add-matcher]${path.join(matchersPath, 'checkstyle.json')}`)

    // TODO: Make this configurable
    const globber = await glob.create('**/checkstyle-result.xml')

    let problems = 0

    console.log('Checkstyle Results\n')

    for await (const filePath of globber.globGenerator()) {
      const data = await readFile(filePath)
      const parsed = (await parseString(data)) as {
        checkstyle: {
          file: CheckstyleFile[]
        }
      }

      for (const fileData of parsed.checkstyle.file) {
        const fileName = fileData.$.name
        if ((!filesList || filesList.includes(fileName)) && fileData.error) {
          console.log(`  ${fileName}`)
          for (const errorData of fileData.error) {
            const error = errorData.$
            let location = error.line
            if (error.column) {
              location += `:${error.column}`
            }
            console.log(
              `    ${location} - ${error.severity} - ${error.message}`
            )
          }

          const fileProblems = fileData.error.length
          problems += fileProblems

          console.log(
            `  ${fileProblems} problem${fileProblems !== 1 ? 's' : ''}\n`
          )
        }
      }
    }

    console.log(`${problems} total problem${problems !== 1 ? 's' : ''}\n`)

    console.log(`##[remove-matcher] owner=checkstyle`)

    if (problems > 0) {
      core.setFailed('Action failed with problems')
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
