const request = require('request-promise')

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

const assignReviewer = (prUrl) => {
  const url = prUrl + "/requested_reviewers"
  const data = {
    "reviewers": JSON.parse(process.env["REVIEWERS"])
  }
  console.log(data, url)
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

module.exports = { fetchPR, comment, draftRelease, assignReviewer }