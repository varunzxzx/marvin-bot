function getAllLines(stringA, stringB, array) {
  const start = findStringInArray(array, stringA)
  const end = findStringInArray(array, stringB)
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

  console.log("oldPurpose", oldPurpose)

  const newPurpose = [...new Set(newData["purpose"].concat(oldPurpose))]

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

module.exports = { getAllLines, findStringInArray, beautifyDraft, appendPRBody }