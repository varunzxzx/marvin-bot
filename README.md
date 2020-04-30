# Github Integration - Node App

### Features
 - Reviewing PRs(Labels, Assigners, Template etc)
 - Auto-assign reviewers
 - Drafting releases
 - Provide lint result on PRs

### Prerequisite
 - NodeJS ([https://nodejs.org/en/download](https://nodejs.org/en/download/))
 - Python ([https://www.python.org/downloads](https://www.python.org/downloads/))

### Setting up a new instance
 - Create ```.env``` file([Read more on Configurations](#Configurationsenv_17))
 - Run ```npm install```
 - To start the server ```npm start```

### Endpoint to set in GitHub
```sh
http://<server_url>:<server_port>/webhook
```
> Note: Only add pull request event for this webhook.

### Configurations(.env)
 - To set server port
 ```PORT=8000```
 - Github Credentials
 ```GITHUB_API=https://github.wdf.sap.corp/api/v3```
```GITHUB_USERNAME=marvin-sap-di-bot-assistant```
```GITHUB_TOKEN=<marvin_user_token>```
 - To enable linting in a repo
 ```LINT_REPO=["<repo-1>", "<repo-2>"]```
 - To enable auto-assign in a repo
 ```REPO=["<repo-1>","<repo-2>"]```
 ```REVIEWERS=["<reviewer1-for-repo1>", ["<reviewer1-for-repo2>", "<reviewer2-for-repo2>"]]```
 - To enable release-drafter in a repo
 ```DRAFT_REPO=["<repo-1>","<repo-2>"]```
 - To add custom pylint config
 ```PYLINT_CONFIG="<config_url>"```