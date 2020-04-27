const request = require('request-promise')
const { appendPRBody, beautifyDraft } = require("./helper")

const api = process.env.GITHUB_API
const username = process.env.GITHUB_USERNAME
const token = process.env.GITHUB_TOKEN

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const fetchPR = function (owner, repo, pullNumber) {
  return request.get(api + '/repos/' + owner + '/' + repo + '/pulls/' + pullNumber, {
    auth: {
      user: username,
      pass: token
    },
    headers: {
      'User-Agent': 'request'
    }
  })
}

const comment = (url, message) => {
  return request(url, {
    method: 'post',
    auth: {
      user: username,
      pass: token
    },
    headers: {
      'User-Agent': 'request'
    },
    body: {
      'body': message
    },
    json: true
  })
}

const draftRelease = (url, data) => {
  
  return request(url, {
    method: 'get',
    auth: {
      user: username,
      pass: token
    },
    headers: {
      'User-Agent': 'request'
    },
    json: true
  })
    .then(resp => {
      const drafts = resp
      let draftUrl = url

      drafts.forEach(function(draft) {
        console.log(draft["name"], data["label"])
        if(draft["name"] === data["label"] && draft["draft"]) {
          draftUrl = draft["url"]
          console.log("Found old draft: ", draft["url"])

          // append body with old content
          data = appendPRBody(data, draft["body"])
        }
      })

      const { name, description, jira, purpose} = data
      const beautifyBody = beautifyDraft({ name, description, jira, purpose})
      const payload = {name: label, body: beautifyBody, tag_name: label, draft: true}      

      return {draftUrl, payload}
    })
    .then(({draftUrl, payload}) => {
      // return "hello"
      return request(draftUrl, {
        method: 'post',
        auth: {
          user: username,
          pass: token
        },
        headers: {
          'User-Agent': 'request'
        },
        body: payload,
        json: true
      })
    })

}

const assignReviewer = (prUrl, reviewers) => {
  const url = prUrl + "/requested_reviewers"
  const data = {
    "reviewers": Array.isArray(reviewers) ? reviewers : [reviewers]
  }
  return request(url, {
    method: 'post',
    auth: {
      user: username,
      pass: token
    },
    headers: {
      'User-Agent': 'request'
    },
    body: data,
    json: true
  })
}

const getAllFiles = (prUrl) => {
  const url = prUrl + "/files"
  return request(url, {
    method: 'get',
    auth: {
      user: username,
      pass: token
    },
    headers: {
      'User-Agent': 'request'
    },
    json: true
  })
}

module.exports = { fetchPR, comment, draftRelease, assignReviewer, getAllFiles }