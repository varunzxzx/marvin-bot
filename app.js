//////////////////// BEWARE OF DIRTY CODE :P /////////////////
const express = require('express')
const app = express()
const fs = require('fs');
const bodyParser = require('body-parser')

const { exec } = require("child_process");
var path = require('path')

const SapCfAxios = require('sap-cf-axios/dist').default;
const destinationName = "my-destination";
const axios = SapCfAxios(destinationName);

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

require('dotenv').config()

const port = process.env.PORT || 3000;

const { fetchPR, comment, draftRelease, assignReviewer, getAllFiles } = require('./github')

const { findStringInArray, getAllLines, savePRNumberForDraft, checkPRNumberForDraft, downloadFile } = require("./helper")

const EMOJI_WRONG = ":heavy_minus_sign:"
const EMOJI_RIGHT = ":white_check_mark:"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

///////////// HELPER FUNCTIONS

function checkBody(body, isCheck) {
  body = body.replace(/[\r\n]+/g, '\n')
  lines = body.split(/\r?\n/);
  const message = [], data = {}
  // check Component name
  let index = findStringInArray(lines, "ML-Component name for PR")
  if(lines[index + 1].includes("Detailed Description of change this PR contains") || lines[index + 1].includes("Example")) {
    message.push(EMOJI_WRONG + "You did not change the example component name with your component name , please fill your component name correctly")
  } else {
    if(!isCheck) {
      data["name"] = getAllLines("ML-Component name for PR", "Detailed Description of change this PR contains", lines)
    }
  }

  //check Description
  index = findStringInArray(lines, "Detailed Description of change this PR contains")
  if(lines[index + 1].includes("Provide links or keys to any relevant tickets") || lines[index + 1].includes("Example")) {
    message.push(EMOJI_WRONG + "You did not change the example description with your component name , please fill your  description as per this PR changes")
  } else {
    if(!isCheck) {
      data["description"] = getAllLines("Detailed Description of change this PR contains", "Provide links or keys to any relevant tickets", lines)
    }
  }

  //check JIRA link
  index = findStringInArray(lines, "Provide links or keys to any relevant tickets")
  if(lines[index + 1].includes("PR is raised for what purpose to solve") || lines[index + 1].includes("Example")) {
    message.push(EMOJI_WRONG + "You did not add the JIRA link , please fill the JIRA link correctly")
  } else {
    if(!isCheck) {
      data["jira"] = getAllLines("Provide links or keys to any relevant tickets", "PR is raised for what purpose to solve", lines)
    }
  }

  //check Purpose
  index = findStringInArray(lines, "Please write your response from below")
  last = findStringInArray(lines, "Passed CI and Integration Test Result link")
  const purpose = []
  const EMOJIS = [":zap:", ":construction:", ":tada:", ":penguin:", ":rotating_light:", ":pushpin:", ":alien:", ":truck:"]
  for(let i = index, j = 0; i < last; i++, j++) {
    if(lines[i].toLowerCase().includes("[x]")) {
      purpose.push(EMOJIS[j] + lines[i].split("]")[1])
    }
  }

  if(!purpose.length) {
    message.push(EMOJI_WRONG + "You did not add the Purpose for the PR , please fill the purpose of the PR")
  } else {
    if(!isCheck) {
      data["purpose"] = purpose
    }
  }

  if(!isCheck) {
    return data
  }

  return message
}

function checkPR(data) {
  let messages = [], flag = true
  const { body, labels } = data
  if(labels.length == 0) {
    messages.push(EMOJI_WRONG + "No labels are present. Make sure if it is release relevant put a label with release name")
    flag = false
  }
  else {
    label = labels[0]["name"].toLowerCase()
    if(label.includes("release")) {
      const checkBodyMessage = checkBody(body, true)
      if(checkBodyMessage.length) {
        messages = messages.concat(checkBodyMessage)
        flag = false
      } else {
        messages.push(EMOJI_RIGHT + "Template filled with your component's details")
      }
    } else {
      flag = false
    }
    messages.push(EMOJI_RIGHT + "Labels are present. Make sure if it is release relevant put a label with release name")
  }

  //check reviewers
  if(data["requested_reviewers"].length === 0) {
    messages.push(EMOJI_RIGHT + "No reviewers assigned , assigning I343977 as default reviewer , feel free to add more reviewer")
    // flag = false
  } else {
    messages.push(EMOJI_RIGHT + "Reviewer assigned.")
  }
  return {messages, flag}
}

function lint(file, comments_url) {
  var currentDir = path.resolve(process.cwd());

  exec("pylint python-files/" + file,  {cwd: currentDir}, (error, stdout, stderr) => {
    console.log(stdout);
    comment(comments_url, stdout)
  });

}

////////// API's

app.get('/', (req, res) => res.send('Hello World!!!!'))

app.get('/fetch-pr/:owner/:repo/:number', (req, res) => {
  const { owner, repo, number } = req.params
  fetchPR(owner, repo, number)
    .then(resp => {
      data = JSON.parse(resp)
      let message = checkPR(data)
      return res.status(200).json({"success": true, message})
    })
    .catch(err => res.status(500).send(err))
})

app.post('/webhook', (req, res) => {
  let data = JSON.parse(req.body["payload"])
  console.log(data["action"])
  fs.writeFile('webhook.json', JSON.stringify(data), function (err) {
    if (err) throw err;
  });
  const action = data["action"]
  if(action === "review_requested" || action === "review_request_removed" || action === "assigned" || action === "unassigned" || action === "closed") {
    return res.status(200).send("got it, Github")
  }

  pr = data["pull_request"]

  getAllFiles(pr["url"])
    .then(resp => {
      pyFiles = resp.filter(({ filename }) => filename.includes(".py"))
      const filename = pyFiles[0]["filename"]
      downloadFile(pyFiles[0]["raw_url"], filename)
      lint(filename, pr["comments_url"])
    })


  const { messages, flag } = checkPR(pr)
  beautifyMessage = ""
  messages.forEach((message, i) => {
    beautifyMessage += " - " + message + "\n"
  });

  console.log(beautifyMessage)

  comment(pr["comments_url"], beautifyMessage)
    .then(resp => console.log("Comment posted"))
    .catch(err => console.log(err))

  // assign reviewers
  const url = pr["url"]
  if(!pr["requested_reviewers"].length && process.env["REPO"] === pr["base"]["repo"]["name"]) {
    // assignReviewer(url)
    // .then(resp => console.log("Reviewer assigned"))
    // .catch(err => console.log(err))
  }  

  if(flag) {
    const { name, description, jira, purpose } = checkBody(pr["body"], false)
    const label = pr["labels"][0]["name"]
    if(!checkPRNumberForDraft(pr["number"])) {
      console.log("drafting release...")
      savePRNumberForDraft(pr["number"])
      draftRelease(data["repository"]["releases_url"].split("{")[0], { name, description, jira, purpose, label })
      .then(resp => console.log("Drafted a release"))
      .catch(err => console.log(err))
    }
  }

  fs.writeFile('result.json', JSON.stringify({"pull_number": data["number"], beautifyMessage}), function (err) {
    if (err) throw err;
    console.log('Result saved');
  })
  return res.status(200).send("got it")
})

app.get('/result', (req, res) => {
  fs.readFile('result.json', function(err, data) {
    data = JSON.parse(data)
    return res.status(200).json(data)
  });
})


////////// TESTING ///////////////

app.get('/test-url', (req, res) => {
 axios({
    method: "get",
    url: "/",
    httpsAgent: new https.Agent({  
      rejectUnauthorized: false
    })
  })
   .then(response => {
     console.log(response)
     return res.status(200).send(response["data"])
   })
   .catch(err => {
     console.log(err)
     return res.status(500).json(err)
   })
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))