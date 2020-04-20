const fs = require('fs');
const https = require('https');
const path = require('path')
const request = require("request")

function downloadFile(url, name) {
  var currentDir = path.resolve(process.cwd());
  request(url).pipe(fs.createWriteStream(currentDir + "/python-files/" + name))
}

function getAllLines(stringA, stringB, array) {
  const start = findStringInArray(array, stringA)
  const end = findStringInArray(array, stringB)
  if(start === -1 || end === -1) {
    return ""
  }
  let result = ""
  for(let i = start + 1; i < end; i++) {
    result += array[i].trim() + "\n"
  }
  return result
}

function findStringInArray(array, str) {
  for(let i = 0; i < array.length; i++) {
    if(array[i].includes(str)) return i;
  }
  return -1
}

function appendPRBody(newData, oldData) {
  oldData = oldData.replace(/[\r\n]+/g, '\n')
  lines = oldData.split(/\r?\n/);

  const oldName = getAllLines("Component/s Name", "Description", lines)
  const newName = newData["name"] + "\n" + oldName

  const oldDescription = getAllLines("Description", "JIRA Link", lines)
  const newDescription = newData["description"] + "\n" + oldDescription

  const oldJIRALink = getAllLines("JIRA Link", "Purpose", lines)
  const newJIRALink = newData["jira"] + "\n" + oldJIRALink

  const oldPurpose = getAllLines("Purpose", "...", lines).split("\n")

  let newPurpose = oldPurpose.map(purpose => {
    let count = 1;
    if(purpose.split("-").length > 1) {
      count = parseInt(purpose.split("-")[1])
    }
    purpose = purpose.split("-")[0]

    if(newData["purpose"].indexOf(purpose) !== -1) {
      count++;
      const index = newData["purpose"].indexOf(purpose)
      newData["purpose"].splice(index, 1);
    }

    if(count > 1) {
      purpose = purpose + " -" + count
    }
    return purpose
  })

  newPurpose = newPurpose.concat(newData["purpose"])

  console.log("newPurpose", newPurpose)

  return {
    "name": newName,
    "description": newDescription,
    "jira": newJIRALink,
    "purpose": newPurpose
  }
}

function beautifyDraft(data) {
  const listPurpose = purposes => {
    return purposes.reduce((acc, purpose, i) => {
      acc += purpose + "\n"
      return acc
    }, "")
  }
  const beautifyBody = `
  ### :zap: Component/s Name
  ${data["name"]}
  ### :pencil: Description
  ${data["description"]}
  ### :rocket: JIRA Link
  ${data["jira"]}
  ### :checkered_flag: Purpose
  ${listPurpose(data["purpose"])}
  ...
  `
  return beautifyBody
}

function savePRNumberForDraft(number) {
  fs.readFile("tracking.json", (err, data) => {
    if(err) {
      console.log(err)
      return
    }
    data = JSON.parse(data)
    data["prDrafts"].push(number)
    
    fs.writeFile("tracking.json", JSON.stringify(data), (err) => {
      if(err) {
        console.log(err)
        return err
      }
      console.log("tracking updated")
    })
  })
}

function checkPRNumberForDraft(number) {
  const data = JSON.parse(fs.readFileSync("tracking.json"))
  return data["prDrafts"].indexOf(number) !== -1
}

module.exports = { getAllLines, findStringInArray, beautifyDraft, appendPRBody, savePRNumberForDraft, checkPRNumberForDraft, downloadFile }