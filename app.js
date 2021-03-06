//////////////////// BEWARE OF DIRTY CODE :P /////////////////
const express = require('express')
const app = express()
const fs = require('fs');
const bodyParser = require('body-parser')
const schedule = require('node-schedule');

const { exec } = require("child_process");
const path = require('path')

const currentDir = path.resolve(process.cwd(), "python-files");


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

require('dotenv').config()

const port = process.env.PORT || 3000;

const { fetchPR, comment, draftRelease, assignReviewer, getAllFiles } = require('./github')

const { findStringInArray, getAllLines, savePRNumber, getPRNumber, downloadFile, initialiseApp } = require("./helper")

const EMOJI_WRONG = ":heavy_minus_sign:"
const EMOJI_RIGHT = ":white_check_mark:"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

initialiseApp()

///////////// SCHEDULED JOBS

const rule = new schedule.RecurrenceRule();
rule.hour = 12;

const PYLINT_CONFIG = process.env.PYLINT_CONFIG || "https://github.wdf.sap.corp/raw/dsp/ci-libraries/master/scripts/pylint.cfg"
 
schedule.scheduleJob(rule, function(){
  downloadFile(PYLINT_CONFIG, ".pylintrc")
});

///////////// HELPER FUNCTIONS

function checkBody(body, isCheck) {
  body = body.replace(/[\r\n]+/g, '\n')
  lines = body.split(/\r?\n/);
  const message = [], data = {}
  // check Component name
  let index = findStringInArray(lines, "ML-Component name for PR")
  if (lines[index + 1].includes("Detailed Description of change this PR contains") || lines[index + 1].includes("Example")) {
    message.push(EMOJI_WRONG + "You did not change the example component name with your component name , please fill your component name correctly")
  } else {
    if (!isCheck) {
      data["name"] = getAllLines("ML-Component name for PR", "Detailed Description of change this PR contains", lines)
    }
  }

  //check Description
  index = findStringInArray(lines, "Detailed Description of change this PR contains")
  if (lines[index + 1].includes("Provide links or keys to any relevant tickets") || lines[index + 1].includes("Example")) {
    message.push(EMOJI_WRONG + "You did not change the example description with your component name , please fill your  description as per this PR changes")
  } else {
    if (!isCheck) {
      data["description"] = getAllLines("Detailed Description of change this PR contains", "Provide links or keys to any relevant tickets", lines)
    }
  }

  //check JIRA link
  index = findStringInArray(lines, "Provide links or keys to any relevant tickets")
  if (lines[index + 1].includes("PR is raised for what purpose to solve") || lines[index + 1].includes("Example")) {
    message.push(EMOJI_WRONG + "You did not add the JIRA link , please fill the JIRA link correctly")
  } else {
    if (!isCheck) {
      data["jira"] = getAllLines("Provide links or keys to any relevant tickets", "PR is raised for what purpose to solve", lines)
    }
  }

  //check Purpose
  index = findStringInArray(lines, "Please write your response from below")
  last = findStringInArray(lines, "Passed CI and Integration Test Result link")
  const purpose = []
  const EMOJIS = [":zap:", ":construction:", ":tada:", ":penguin:", ":rotating_light:", ":pushpin:", ":alien:", ":truck:"]
  for (let i = index, j = 0; i < last; i++, j++) {
    if (lines[i].toLowerCase().includes("[x]")) {
      purpose.push(EMOJIS[j] + lines[i].split("]")[1])
    }
  }

  if (!purpose.length) {
    message.push(EMOJI_WRONG + "You did not add the Purpose for the PR , please fill the purpose of the PR")
  } else {
    if (!isCheck) {
      data["purpose"] = purpose
    }
  }

  if (!isCheck) {
    return data
  }

  return message
}

function checkPR(data, prState) {
  const DRAFT_REPO = JSON.parse(process.env.DRAFT_REPO)

  let messages = [], flag = true
  const { body, labels } = data
  if (labels.length == 0) {
    messages.push(EMOJI_WRONG + "No labels are present. Make sure if it is release relevant put a label with release name")
    flag = false
  }
  else {
    label = labels[0]["name"].toLowerCase()
    if (checkIncludes(data["base"]["repo"]["name"], DRAFT_REPO) && label.includes("release") && !prState["isBodyCheck"]) {
      const checkBodyMessage = checkBody(body, true)
      if (checkBodyMessage.length) {
        messages = messages.concat(checkBodyMessage)
        flag = false
      } else {
        if (!prState["isBodyCheck"])
          messages.push(EMOJI_RIGHT + "Template filled with your component's details")
      }
    }
    if (!prState["isLabelCheck"])
      messages.push(EMOJI_RIGHT + "Labels are present. Make sure if it is release relevant put a label with release name")
    prState["isLabelCheck"] = true
  }

  return { messages, flag }
}

function checkIncludes(str, array) {
  for (let i = 0; i < array.length; i++) {
    if (str.includes(array[i])) return true
  }
  return false
}

function lint(files, comments_url) {
  // spellCheck(files)
  console.log(files)
  exec("pylint " + files.join(" "), { cwd: currentDir }, (error, stdout, stderr) => {
    stdout = stdout.replace(/[\r\n]+/g, '\n')
    const lines = stdout.split(/\r?\n/);
    if (!error && !stdout) {
      console.log("calling again...")
      return lint(files, comments_url)
    }
    console.log(stdout)
    const body = `I've detected ${files.length === 1 ? "one" : "some"} python file${files.length === 1 ? "" : "s"}. Here is the pylint result for it.`

    let result = ""

    lines.forEach((line, i) => {
      if (line.includes("*****")) {
        result += "\n> :pushpin: " + line.replace(/\*/g, "")
      } else if (checkIncludes(line, files)) {
        result += "\n<pre>" + line + "\n"
        let j = i + 1;
        if (lines[j] && !lines[j].includes("---------")) {
          while (!checkIncludes(lines[j], files) && !lines[j].includes("*****")) {
            result += lines[j] + "\n"
            j++;
          }
        }
        result += "</pre>"
      }
    })

    comment(comments_url, body + "\n" + result)
  });

}

////////// API's

app.post('/webhook', (req, res) => {
  let data = JSON.parse(req.body["payload"])
  console.log(data["action"])
  fs.writeFile('webhook.json', JSON.stringify(data), function (err) {
    if (err) throw err;
  });
  const action = data["action"]
  if (action === "review_requested" || action === "review_request_removed" || action === "assigned" || action === "unassigned" || action === "closed") {
    return res.status(200).send("got it, Github")
  }

  pr = data["pull_request"]

  let prState = {
    "isLabelCheck": false,
    "isBodyCheck": false,
    "isDraftCreated": false
  }

  /////////////// TRACK PR //////////////////
  if (getPRNumber(pr["number"], pr["base"]["repo"]["full_name"])) {
    console.log("got object")
    prState = getPRNumber(pr["number"], pr["base"]["repo"]["full_name"])
  } else {
    savePRNumber(pr["number"], pr["base"]["repo"]["full_name"], prState)
  }

  const LINT_REPO = JSON.parse(process.env.LINT_REPO)
  const DRAFT_REPO = JSON.parse(process.env.DRAFT_REPO)

  if (checkIncludes(pr["base"]["repo"]["name"], LINT_REPO)) {
    getAllFiles(pr["url"])
      .then(resp => {
        pyFiles = resp.filter(({ filename }) => filename.includes(".py"))
        if (pyFiles.length === 0) return;
        const filesName = pyFiles.map(file => {
          const arr = file["filename"].split("/")
          return arr[arr.length - 1]
        })

        const promises = []
        pyFiles.forEach(pyFile => {
          const arr = pyFile["filename"].split("/")
          const filename = arr[arr.length - 1]
          promises.push(downloadFile(pyFile["raw_url"], filename))
        })

        if (promises.length) {
          Promise.all(promises)
            .then(() => {
              console.log("Linting...")
              lint(filesName, pr["comments_url"])
            })
            .catch(err => {
              console.log("Error downloading file: " + err)
            })
        }

      })
  }

  const { messages, flag } = checkPR(pr, prState)

  const REPO = JSON.parse(process.env["REPO"])
  const REVIEWERS = JSON.parse(process.env["REVIEWERS"])

  // assign reviewers
  const url = pr["url"]
  if (!pr["requested_reviewers"].length && checkIncludes(pr["base"]["repo"]["name"], REPO)) {
    const reviewers = REVIEWERS[REPO.indexOf(pr["base"]["repo"]["name"])]
    messages.push(EMOJI_RIGHT + "No reviewers assigned , assigning I343977 as default reviewer , feel free to add more reviewer")
    assignReviewer(url, reviewers)
      .then(resp => console.log("Reviewer assigned"))
      .catch(err => console.log("err assigning reviewer"))
  }

  beautifyMessage = ""
  messages.forEach((message, i) => {
    beautifyMessage += " - " + message + "\n"
  });

  console.log(beautifyMessage)

  if (!prState["isBodyCheck"] || !prState["isLabelCheck"]) {
    comment(pr["comments_url"], beautifyMessage)
      .then(resp => console.log("Comment posted"))
      .catch(err => console.log(err))
  }

  if (flag && checkIncludes(pr["base"]["repo"]["name"], DRAFT_REPO)) {
    const { name, description, jira, purpose } = checkBody(pr["body"], false)
    const label = pr["labels"][0]["name"]
    if (!prState["isDraftCreated"] && label.toLowerCase().includes("release")) {
      console.log("drafting release...")
      draftRelease(data["repository"]["releases_url"].split("{")[0], { name, description, jira, purpose, label })
        .then(resp => console.log("Drafted a release"))
        .catch(err => console.log(err))
      prState["isDraftCreated"] = true

    }
    if (label.toLowerCase().includes("release")) {
      prState["isBodyCheck"] = true
    }
    savePRNumber(pr["number"], pr["base"]["repo"]["full_name"], prState)
  }

  fs.writeFile('result.json', JSON.stringify({ "pull_number": data["number"], beautifyMessage }), function (err) {
    if (err) throw err;
    console.log('Result saved');
  })
  return res.status(200).send("got it")
})


////////// TESTING ///////////////
const SapCfAxios = require('sap-cf-axios/dist').default;

app.get('*', (req, res) => {

  const axios = SapCfAxios(req.query.svc || 'wiki');

  console.log(req.path)
  var Authorization = req.headers.authorization;
  axios({
    method: "get",
    url: req.path || '/',
    headers: {
      Authorization
    }
  })
    .then(response => {
      //  console.log(response)
      if (req.path.includes(".css")) {
        console.log("got css")
        res.setHeader('Content-Type', 'text/css')
      }
      if (typeof response["data"] === "string") {
        return res.status(200).send(response["data"].replace(/https:\/\/github.wdf.sap.corp/g, ""))
      }
      return res.status(200).send(response["data"])
    })
    .catch(err => {
      console.log(err)
      return res.status(500).json(err)
    })
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))