import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs'
import * as path from 'path'
import {promisify} from 'util'
import * as xml from 'xml2js'

const readFile = promisify(fs.readFile)
const parseString = promisify(xml.parseString)

async function run(): Promise<void> {
  try {
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
          file: {
            $: {name: string}
            error: {
              $: {
                line: string
                severity: string
                message: string
                column: string | undefined
              }
            }[]
          }[]
        }
      }

      for (const fileData of parsed.checkstyle.file) {
        console.log(`  ${fileData.$.name}`)
        for (const errorData of fileData.error) {
          const error = errorData.$
          let location = error.line
          if (error.column) {
            location += `:${error.column}`
          }
          console.log(`    ${location} - ${error.severity} - ${error.message}`)
        }

        const fileProblems = fileData.error.length
        problems += fileProblems

        console.log(
          `  ${fileProblems} problem${fileProblems !== 1 ? 's' : ''}\n`
        )
      }

      console.log(`${problems} total problem${problems !== 1 ? 's' : ''}\n`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
